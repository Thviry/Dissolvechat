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
    const t = ctx.currentTime;

    // First tone — soft low drop
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(330, t);
    osc1.frequency.exponentialRampToValueAtTime(280, t + 0.15);
    gain1.gain.setValueAtTime(0.1, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc1.start(t);
    osc1.stop(t + 0.2);

    // Second tone — rising lift (the good feeling)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(350, t + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(440, t + 0.3);
    gain2.gain.setValueAtTime(0.001, t + 0.12);
    gain2.gain.linearRampToValueAtTime(0.12, t + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc2.start(t + 0.12);
    osc2.stop(t + 0.45);
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
 * Show an OS/system notification if permission is granted.
 */
function showSystemNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}

/**
 * Request notification permission (call once on user interaction).
 */
export function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

/**
 * Notify the user of a new incoming message (audio + visual + OS).
 */
export function notifyIncoming(senderName) {
  playPing();
  flashTitle("New message!");
  if (!document.hasFocus()) {
    showSystemNotification(
      senderName || "New message",
      senderName ? "sent you a message" : "You have a new message"
    );
  }
}
