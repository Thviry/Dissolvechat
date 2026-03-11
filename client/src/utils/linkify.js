// client/src/utils/linkify.js
// Parse message text into segments of plain text and links.
// Security: only http/https allowed. javascript:, data:, vbscript:, blob: are blocked.
// No external requests — this is pure string parsing.

const URL_RE = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+\.[^\s<>"']+/gi;
const BLOCKED_RE = /^(javascript|data|vbscript|blob):/i;
const TRAILING_PUNCT = /[.,;:!?)>\]]+$/;

function cleanTrailing(url) {
  let cleaned = url;
  const trail = [];

  while (TRAILING_PUNCT.test(cleaned)) {
    const last = cleaned[cleaned.length - 1];
    if (last === ")" && (cleaned.match(/\(/g) || []).length >= (cleaned.match(/\)/g) || []).length) {
      break;
    }
    if (last === "]" && (cleaned.match(/\[/g) || []).length >= (cleaned.match(/\]/g) || []).length) {
      break;
    }
    trail.unshift(cleaned[cleaned.length - 1]);
    cleaned = cleaned.slice(0, -1);
  }

  return { url: cleaned, trailing: trail.join("") };
}

export function parseLinks(text) {
  if (!text) return [{ type: "text", value: "" }];

  const segments = [];
  let lastIndex = 0;

  URL_RE.lastIndex = 0;

  let match;
  while ((match = URL_RE.exec(text)) !== null) {
    const rawUrl = match[0];
    const start = match.index;

    if (BLOCKED_RE.test(rawUrl)) continue;

    const { url } = cleanTrailing(rawUrl);

    if (start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, start) });
    }

    const href = url.startsWith("www.") ? `https://${url}` : url;
    segments.push({ type: "link", value: url, href });

    lastIndex = start + url.length;
    URL_RE.lastIndex = lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    return [{ type: "text", value: text }];
  }

  return segments;
}
