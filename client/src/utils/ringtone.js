let audioCtx = null;
let ringInterval = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playRingTone() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    // Tone A: 440Hz sine, 0.3s
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(440, t);
    gain1.gain.setValueAtTime(0.15, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc1.start(t);
    osc1.stop(t + 0.3);
    // Tone B: 520Hz sine, 0.3s, offset 0.35s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(520, t + 0.35);
    gain2.gain.setValueAtTime(0.15, t + 0.35);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    osc2.start(t + 0.35);
    osc2.stop(t + 0.65);
  } catch { /* audio not available */ }
}

export function startRinging() {
  stopRinging();
  playRingTone();
  ringInterval = setInterval(playRingTone, 2000);
}

export function stopRinging() {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
}

export function playCallConnected() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, t);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.15);
  } catch { /* audio not available */ }
}

export function playCallEnded() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.3);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  } catch { /* audio not available */ }
}
