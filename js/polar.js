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

// Per-turn record of where darts actually landed — for any player, not just
// the CPU (human throws will use it too). One entry per thrown dart, kept as
// a subsequence of turn.throws: the synthetic 'MISS' fillers pushed after a
// bust carry no entry, and nothing else does. Entry shape is { r, angle,
// field } plus `ideal` (the field the CPU aimed at) on CPU darts only.
// Undo pops entries in `revertPlayerStats` (dartIndex < turn.hits.length).
function recordDartHit(turn, hit) {
  if (!turn.hits) turn.hits = [];
  turn.hits.push(hit);
}
