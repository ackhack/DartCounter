'use strict';

// 1. Select the target element
const targetElement = document.getElementById("dartit-bridge-count");

if (targetElement) {
  // 2. Create a MutationObserver instance
  const observer = new MutationObserver((mutationsList, observer) => {
    for (let mutation of mutationsList) {
      // Check if the text content or character data changed
      if (mutation.type === "childList" || mutation.type === "characterData") {
        console.log("The innerText has changed to:", targetElement.innerText);
        
        applyDartItUpdate();
      }
    }
  });

  // 3. Configure the observer to watch for text and child changes
  const config = { 
    childList: true,      // Watches for adding/removing children (text nodes count as children)
    subtree: true,        // Watches deep inside the element if text is wrapped in spans
    characterData: true   // Watches directly for text changes
  };

  // 4. Start observing the target element
  observer.observe(targetElement, config);

  // Example: To stop observing later, you can call:
  // observer.disconnect();
} else {
  console.warn("Element with ID 'dartit-bridge-count' not found.");
}

let lastDartItValue = "";
function applyDartItUpdate() {
  let newVal = document.getElementById("dartit-bridge-value").innerText;
  if (newVal === lastDartItValue){
    console.log("Duplicate entry from DartIt")
    return;
  }
  lastDartItValue = newVal;
  
  const dat = parseDetect(JSON.parse(newVal));
  console.log('Received from DartIt ' + (dat ? dat.token : null))
  if (dat != null) {
    // The impact point (if the response carried board coordinates) rides on
    // the throw — submitScore records it on the turn, so the end-of-game
    // boards plot it.
    applyThrowToken(dat.token, dat.hit ? { r: dat.hit.r, angle: dat.hit.angle, field: dat.token } : null);
    submitScore();
  }
}

// Turn a raw detect response into the throw token that applyThrowToken()
// (js/input.js) understands — "T11", "D20", "15", "Bull", "BE", "0" — plus
// the impact point converted to the app's polar system (dartitToPolar,
// js/polar.js) when the response carries board coordinates.
// Returns { token, hit } (hit = { r, angle }, or null when the coordinates
// are missing/unusable), or null for anything unrecognised so we never
// score a bad throw.
// Sample: {"numbers":5,"fields":"S","p_board_x":12.64090633392334,"p_board_y":5.5260701179504395,"p_board_z":0,"p_above_x":13.195976257324219,"p_above_y":5.719679355621338,"p_above_z":11.985591888427734}
function parseDetect(data) {
  if (!data) return null;
  const fields = String(data.fields || '').toUpperCase();
  const num = data.numbers;

  let token = null;

  // Bull / bullseye — explicit field indicators win; numbers:25 is only the
  // fallback when fields doesn't already name the ring.
  if (fields === 'BE' || fields === 'BULLSEYE' || (num === 25 && fields === 'D')) token = 'BE';
  else if (fields === 'B' || num === 25) token = 'Bull';
  // Miss
  else if (fields === '0' || fields === 'M' || fields === 'MISS' || num === 0) token = '0';
  // Numbered sections (single / double / triple)
  else if (Number.isInteger(num) && num >= 1 && num <= 20) {
    if (fields === 'T') token = 'T' + num;
    else if (fields === 'D') token = 'D' + num;
    else token = String(num);
  }

  if (token == null) return null;

  // Impact point in the board plane (cm from the board center). Missing or
  // non-numeric coordinates leave hit null — the dart still scores.
  let hit = null;
  if (Number.isFinite(data.p_board_x) && Number.isFinite(data.p_board_y)) {
    hit = dartitToPolar(data.p_board_x, data.p_board_y);
  }
  return { token: token, hit: hit };
}

// --- manual recalibration ---
// The "Recalibrate" button (game header) asks the extension to run the
// dartit.net recalibration sequence. A plain page can only talk to the
// extension through its content script, so we window.postMessage out and
// plugin/dartit-bridge/dartcounter-content.js relays it to the background,
// which delivers it to the dartit.net tab; injected.js then runs
// startRecalibration(). The ack tells us whether a dartit tab was actually
// reached, so the button can say so instead of silently doing nothing.
const recalibrateBtn = document.getElementById("recalibrate-btn");
let recalibrateLabelTimer = null;

function setRecalibrateLabel(text, ms) {
  if (!recalibrateBtn) return;
  recalibrateBtn.textContent = text;
  if (recalibrateLabelTimer) clearTimeout(recalibrateLabelTimer);
  recalibrateLabelTimer = setTimeout(() => {
    recalibrateBtn.textContent = "Recalibrate";
    recalibrateLabelTimer = null;
  }, ms);
}

if (recalibrateBtn) {
  recalibrateBtn.addEventListener("click", () => {
    setRecalibrateLabel("Sending…", 4000);
    window.postMessage(
      { source: "dartcounter-bridge", type: "RECALIBRATE" },
      window.location.origin
    );
  });
}

// --- transient toast for DartIt events ---
let dartItToastTimer = null;

function showDartItToast(text, isError) {
  const toast = document.getElementById("dartit-toast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.toggle("error", !!isError);
  toast.classList.add("visible");
  if (dartItToastTimer) clearTimeout(dartItToastTimer);
  dartItToastTimer = setTimeout(() => {
    toast.classList.remove("visible");
    dartItToastTimer = null;
  }, 3000);
}

// Events from the extension content script (calibration finished,
// recalibrate ack).
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.source !== "dartit-bridge") return;

  if (msg.type === "RECALIBRATE_ACK") {
    setRecalibrateLabel(msg.ok ? "Sent ✓" : "No DartIt tab", 1500);
  } else if (msg.type === "CALIB_COMPLETE") {
    console.log('Calibration complete from DartIt');
    showDartItToast("Calibration completed");
  } else if (msg.type === "CALIB_FAILED") {
    // msg.data.status — the HTTP status, or 0 when the request got no
    // response at all (network error).
    const status = msg.data && msg.data.status;
    console.log('Calibration request not successful from DartIt', msg.data);
    showDartItToast(
      status
        ? "Calibration failed (" + (status === 0 ? "no response" : status) + ")"
        : "Calibration failed",
      true
    );
  }
});