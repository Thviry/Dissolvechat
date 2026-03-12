/** Derive a stable hue (0-359) from an identity ID string */
export function idToHue(id) {
  if (!id) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return ((hash % 360) + 360) % 360;
}

/** Format seconds into MM:SS or H:MM:SS */
export function formatCallDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
