'use strict';

function applyDartItUpdate() {
  const dat = parseDetect(JSON.parse(document.getElementById("dartit-bridge-value").innerText));
  console.log('Received from DartIt ' + dat)
  if (dat != null) {
    applyThrowToken(dat);
    submitScore();
  }
}

// Turn a raw detect response into a throw token that applyThrowToken()
// (js/input.js) understands, e.g. "T11", "D20", "15", "Bull", "BE", "0".
// Returns null for anything unrecognised so we never score a bad throw.
function parseDetect(data) {
  if (!data) return null;
  const fields = String(data.fields || '').toUpperCase();
  const num = data.numbers;

  // Bull / bullseye — explicit field indicators win; numbers:25 is only the
  // fallback when fields doesn't already name the ring.
  if (fields === 'BE' || fields === 'BULLSEYE' || (num === 25 && fields === 'D')) return 'BE';
  if (fields === 'B' || num === 25) return 'Bull';

  // Miss
  if (fields === '0' || fields === 'M' || fields === 'MISS' || num === 0) return '0';

  // Numbered sections (single / double / triple)
  if (Number.isInteger(num) && num >= 1 && num <= 20) {
    if (fields === 'T') return 'T' + num;
    if (fields === 'D') return 'D' + num;
    return String(num);
  }

  return null;
}