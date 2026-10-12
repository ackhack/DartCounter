// ===========================
// DART COUNTER - Polar Board Coordinates
// ===========================
'use strict';

// WDF-regulation board dimensions (mm). The polar system is normalized so
// the outer edge of the double ring (170 mm) is radius 1.0 — anything above
// 1 is a miss outside the board.
const BULLSEYE_RADIUS_MM = 6.35;
const BULL_RADIUS_MM = 15.9;
const INNER_SINGLE_EDGE_MM = 99;
const TRIPLE_EDGE_MM = 107;
const OUTER_SINGLE_EDGE_MM = 160;
const BOARD_PLAYABLE_RADIUS_MM = 170;

// Center radius a dart aims at for each ring (normalized). Singles aim at
// the center of the bigger outer field, not the inner one.
const BULL_AIM_R = (BULLSEYE_RADIUS_MM + BULL_RADIUS_MM) / 2 / BOARD_PLAYABLE_RADIUS_MM;
const TRIPLE_AIM_R = (INNER_SINGLE_EDGE_MM + TRIPLE_EDGE_MM) / 2 / BOARD_PLAYABLE_RADIUS_MM;
const SINGLE_AIM_R = (TRIPLE_EDGE_MM + OUTER_SINGLE_EDGE_MM) / 2 / BOARD_PLAYABLE_RADIUS_MM;
const DOUBLE_AIM_R = (OUTER_SINGLE_EDGE_MM + BOARD_PLAYABLE_RADIUS_MM) / 2 / BOARD_PLAYABLE_RADIUS_MM;

// Board angles are radians: 0 points to the top of the board (center of the
// 20), positive angles run clockwise (6 at π/2, 3 at π, 11 at 3π/2).
const SECTOR_ANGLE = Math.PI / 10; // 20 sectors of 18°
const DARTBOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Max radius of the CPU's error disk: difficulty 0 can land anywhere on the
// board, difficulty 100 stays within a few mm of the aim point. Linear.
const CPU_AIM_RADIUS_EASIEST = 1.0;
const CPU_AIM_RADIUS_HARDEST = 0.05;

// Translate a point in the board's polar system to the throw token it
// scores: ("T20", "D20", "20", "Bull", "BE") or "0" for a miss off the board.
function polarToField(r, angle) {
  if (r > 1) return '0';
  if (r <= BULLSEYE_RADIUS_MM / BOARD_PLAYABLE_RADIUS_MM) return 'BE';
  if (r <= BULL_RADIUS_MM / BOARD_PLAYABLE_RADIUS_MM) return 'Bull';

  let prefix = '';
  if (r <= TRIPLE_EDGE_MM / BOARD_PLAYABLE_RADIUS_MM && r > INNER_SINGLE_EDGE_MM / BOARD_PLAYABLE_RADIUS_MM) {
    prefix = 'T';
  } else if (r > OUTER_SINGLE_EDGE_MM / BOARD_PLAYABLE_RADIUS_MM) {
    prefix = 'D';
  }

  const norm = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const idx = Math.floor((norm + SECTOR_ANGLE / 2) / SECTOR_ANGLE) % 20;
  return prefix + DARTBOARD_ORDER[idx];
}

// The polar point to aim at for a given field: the field's center where it
// exists (bull aims at 0°), radius 0 for the bulls-eye. Scoreable fields
// only — "0" is never aimed at.
function fieldToPolar(token) {
  const t = token.toUpperCase();
  if (t === 'BE') return { r: 0, angle: 0 };
  if (t === 'BULL') return { r: BULL_AIM_R, angle: 0 };

  const m = t.match(/^([TD]?)(\d+)$/);
  const n = parseInt(m[2], 10);
  const r = m[1] === 'T' ? TRIPLE_AIM_R : m[1] === 'D' ? DOUBLE_AIM_R : SINGLE_AIM_R;
  return { r, angle: DARTBOARD_ORDER.indexOf(n) * SECTOR_ANGLE };
}

// --- DartIt bridge: camera board-plane coordinates -> polar ---
//
// The detect response reports the impact point as p_board_x / p_board_y in
// cm, origin at the board center, y up. The DartIt calibration axes are
// rotated against the physical board, so a constant angle offset is needed.
// Calibrated against real throws (samples.txt, 2026-10-11, 63 darts): the
// offset window that reproduces every scored sector is 80.3-81.6 deg;
// 80.9 deg is its midpoint. If the dartit calibration changes, re-fit from
// a fresh log.
const DARTIT_ANGLE_OFFSET = 1.412713; // 80.943 deg

function dartitToPolar(xCm, yCm) {
  const r = Math.hypot(xCm, yCm) / (BOARD_PLAYABLE_RADIUS_MM / 10);
  const angle = ((Math.atan2(xCm, yCm) - DARTIT_ANGLE_OFFSET) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return { r, angle };
}

// Where the CPU actually lands when it aims at idealToken: a random point
// in a disk around the aim point whose max radius shrinks with difficulty.
// The distance is uniform on [0, maxR] (small errors more likely than big
// ones); use Math.sqrt(Math.random()) there for a uniform-in-area spread
// instead. Local 0 points from the aim point toward the board center, so
// the offset direction in board coordinates is target.angle + localAngle + π
// — with x = r·sin(θ), y = r·cos(θ) that simplifies to
// hit = aim − localR·(sin(θ_t + θ_l), cos(θ_t + θ_l)).
// Returns { r, angle, field, ideal } in the original board system.
function cpuAimHit(idealToken, difficulty) {
  const target = fieldToPolar(idealToken);
  const maxR = CPU_AIM_RADIUS_EASIEST -
    (CPU_AIM_RADIUS_EASIEST - CPU_AIM_RADIUS_HARDEST) * (difficulty / 100);
  const localR = maxR * Math.random();
  const localAngle = 2 * Math.PI * Math.random();

  const x = target.r * Math.sin(target.angle) - localR * Math.sin(target.angle + localAngle);
  const y = target.r * Math.cos(target.angle) - localR * Math.cos(target.angle + localAngle);
  const r = Math.hypot(x, y);
  const angle = ((Math.atan2(x, y) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  return { r, angle, field: polarToField(r, angle), ideal: idealToken };
}

// Per-turn record of where darts actually landed — CPU darts and DartIt
// bridge darts; manual input has no recorded landing and carries no entry.
// Kept as a subsequence of turn.throws: the synthetic 'MISS' fillers pushed
// after a bust carry no entry, and nothing else does. Entry shape is
// { r, angle, field } plus `ideal` (the field it aimed at: the CPU's
// planned field, else the throw-time X01 suggestion stamped on by
// applyThrowToken).
// Undo pops entries in `revertPlayerStats` (dartIndex < turn.hits.length).
function recordDartHit(turn, hit) {
  if (!turn.hits) turn.hits = [];
  turn.hits.push(hit);
}

// --- End-of-game board display ---

// dartboard.png (generated by gen_dartboard.py) is 1200 px; its playable
// radius (outer double-ring edge, r = 1.0) is 540 px, i.e. 0.9 of the
// half-size. Keep in sync with PLAYABLE_R / (SIZE / 2) in the generator.
const DARTBOARD_PLAYABLE_FRACTION = 0.9;

// CSS position (percent of the square board image) for a polar point.
// Same angle convention as the rest of polar.js: 0 at the top, clockwise.
function boardDotPosition(r, angle) {
  return {
    left: 50 + 50 * DARTBOARD_PLAYABLE_FRACTION * r * Math.sin(angle),
    top: 50 - 50 * DARTBOARD_PLAYABLE_FRACTION * r * Math.cos(angle)
  };
}

// Color for an ideal throw (the field a dart aimed at): hue by sector
// position (the 20 sectors step 18 deg around the wheel) and lightness by
// ring — doubles dark, singles mid, triples light — so one sector reads as
// a three-step ramp. Bull and bulls-eye keep the board's own bull colors
// (red / gold); they sit at the center, far from any numbered sector, so
// the hue overlap with a sector is never visible in practice.
// With an alpha argument the color comes back as hsla() for the translucent
// zone disks.
function fieldColor(token, alpha) {
  const t = String(token).toUpperCase();
  let h, s, l;
  if (t === 'BULL') {
    h = 0; s = 85; l = 60;
  } else if (t === 'BE') {
    h = 48; s = 100; l = 60;
  } else {
    const m = t.match(/^([TD]?)(\d+)$/);
    h = DARTBOARD_ORDER.indexOf(parseInt(m[2], 10)) * 18;
    if (m[1] === 'T') { s = 100; l = 72; }
    else if (m[1] === 'D') { s = 85; l = 42; }
    else { s = 75; l = 58; }
  }
  return alpha === undefined
    ? 'hsl(' + h + ', ' + s + '%, ' + l + '%)'
    : 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + alpha + ')';
}

// Aggregate every dart one player threw, for the end-screen boards.
// `turns` is the list of turn objects (state.history, optionally plus the
// in-progress _currentPlayerTurn). Only darts with a recorded landing
// (CPU darts, DartIt bridge darts) get a dot — manual input has no recorded
// landing and gets none (the center of the scored field would be a guess);
// it still counts in `darts`. Bust auto-miss fillers ('MISS') were never
// thrown and are skipped; real misses count in `misses` but get no dot.
// Each dot carries `ideal` — the field the dart aimed at, stamped on the
// hit entry at throw time (applyThrowToken): the recorded aim on CPU darts,
// else the X01 checkout suggestion / DEFAULT_PLAYER_AIM. fieldColor() keys
// off it for the dot/zone colors.
function collectBoardDarts(turns, playerId) {
  const dots = [];
  let darts = 0;
  let misses = 0;

  for (const turn of turns) {
    if (!turn || turn.playerId !== playerId) continue;
    let hitIdx = 0;
    for (const label of turn.throws) {
      const fieldLabel = label.replace(' (BUST)', '');
      if (fieldLabel === 'MISS') continue; // auto-filler, not thrown
      darts++;

      const hit = turn.hits && hitIdx < turn.hits.length ? turn.hits[hitIdx++] : null;
      if (hit) {
        if (hit.r <= 1) dots.push({ r: hit.r, angle: hit.angle, ideal: hit.ideal || DEFAULT_PLAYER_AIM });
        else misses++;
      } else if (fieldLabel === 'Miss') {
        misses++;
      }
    }
  }
  return { dots: dots, darts: darts, misses: misses };
}

// How far beyond the farthest dart a zone disk extends (board units,
// 1 = playable edge) — a bit over one dot radius, so even a lone dart
// landing exactly on the aim point gets a visible halo.
const BOARD_ZONE_PADDING = 0.04;

// The translucent zone disks for the end-screen boards: one per ideal field
// that at least one plotted dot aimed at. Each disk is centered on the
// field's aim point (the center of the ideal throw) and its radius reaches
// the farthest dot that aimed at it, so the disk includes all of that
// ideal's throws. Returns [{ ideal, r, angle, radius }] in board units, in
// first-seen order of the ideals.
function boardZones(dots) {
  const groups = {};
  dots.forEach((d) => {
    (groups[d.ideal] = groups[d.ideal] || []).push(d);
  });

  const zones = [];
  Object.keys(groups).forEach((ideal) => {
    const aim = fieldToPolar(ideal);
    const ax = aim.r * Math.sin(aim.angle);
    const ay = aim.r * Math.cos(aim.angle);
    let farthest = 0;
    groups[ideal].forEach((d) => {
      farthest = Math.max(farthest, Math.hypot(
        d.r * Math.sin(d.angle) - ax,
        d.r * Math.cos(d.angle) - ay
      ));
    });
    zones.push({ ideal: ideal, r: aim.r, angle: aim.angle, radius: farthest + BOARD_ZONE_PADDING });
  });
  return zones;
}
