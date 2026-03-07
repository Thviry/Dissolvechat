// client/src/utils/notifications.js
// Audio ping and visual title flash for incoming messages.

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

/**
 * Play a short notification ping using Web Audio API.
 */
export function playPing() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // Audio not available — ignore
  }
}

let flashInterval = null;
const originalTitle = document.title;

/**
 * Flash the page title to indicate unread messages.
 * Automatically stops when the window regains focus.
 */
export function flashTitle(message = "New message!") {
  if (document.hasFocus()) return;
  if (flashInterval) return; // already flashing

  let show = true;
  flashInterval = setInterval(() => {
    document.title = show ? message : originalTitle;
    show = !show;
  }, 1000);

  const stop = () => {
    clearInterval(flashInterval);
    flashInterval = null;
    document.title = originalTitle;
    window.removeEventListener("focus", stop);
  };
  window.addEventListener("focus", stop);
}

/**
 * Notify the user of a new incoming message (audio + visual).
 */
export function notifyIncoming() {
  playPing();
  flashTitle("New message!");
}
