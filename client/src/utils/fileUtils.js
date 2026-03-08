// client/src/utils/fileUtils.js
// Utilities for reading, encoding, and downloading files.

/**
 * Read a File object into a base64 string.
 * @param {File} file
 * @returns {Promise<string>} base64-encoded file content
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:<mime>;base64,<data>" — extract just the base64 part
      const b64 = reader.result.split(",")[1];
      resolve(b64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a base64 string back to a Blob.
 * @param {string} b64 - base64-encoded data
 * @param {string} mimeType - MIME type for the blob
 * @returns {Blob}
 */
export function base64ToBlob(b64, mimeType) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Trigger a browser download for a Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  // Use data URI for broader compatibility (Tauri webview doesn't always support blob URL downloads)
  const reader = new FileReader();
  reader.onload = () => {
    const a = document.createElement("a");
    a.href = reader.result;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  reader.readAsDataURL(blob);
}

/**
 * Format a byte count as a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
