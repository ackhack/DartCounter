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

// --- manual recalibration ---
// The "Recalibrate" button (game header) asks the extension to run the
// dartit.net recalibration sequence. A plain page can only talk to the
// extension through its content script, so we window.postMessage out and
// plugin/dartit-bridge/dartcounter-content.js relays it to the background,
// which delivers it to the dartit.net tab; injected.js then runs
// startRecalibration(). The ack tells us whether a dartit tab was actually
// reached, so the button can say so instead of silently doing nothing.
const recalibrateBtn = document.getElementById("recalibrate-btn");
if (recalibrateBtn) {
  let recalibrateLabelTimer = null;

  function setRecalibrateLabel(text, ms) {
    recalibrateBtn.textContent = text;
    if (recalibrateLabelTimer) clearTimeout(recalibrateLabelTimer);
    recalibrateLabelTimer = setTimeout(() => {
      recalibrateBtn.textContent = "Recalibrate";
      recalibrateLabelTimer = null;
    }, ms);
  }

  recalibrateBtn.addEventListener("click", () => {
    setRecalibrateLabel("Sending…", 4000);
    window.postMessage(
      { source: "dartcounter-bridge", type: "RECALIBRATE" },
      window.location.origin
    );
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== "dartit-bridge" || msg.type !== "RECALIBRATE_ACK") return;
    setRecalibrateLabel(msg.ok ? "Sent ✓" : "No DartIt tab", 1500);
  });
}