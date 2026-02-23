// client/src/components/ShareModal.jsx
import { useState, useMemo } from "react";
import { generateQRSvg } from "../utils/qrcode";

export default function ShareModal({ cardData, onDownloadCard, onDownloadProfile, onClose }) {
  const [tab, setTab] = useState("link"); // link | file | qr
  const [copied, setCopied] = useState(false);

  // Build a shareable link with the contact card encoded as a URL-safe base64 fragment
  const shareLink = useMemo(() => {
    if (!cardData) return "";
    const json = JSON.stringify(cardData);
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const origin = window.location.origin;
    return `${origin}#contact=${b64}`;
  }, [cardData]);

  const qrSvg = useMemo(() => {
    if (!shareLink) return "";
    try {
      return generateQRSvg(shareLink, 3, 4);
    } catch {
      return null;
    }
  }, [shareLink]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = shareLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Share Contact</h3>
          <button className="btn-icon modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="share-tabs">
          <button
            className={`share-tab ${tab === "link" ? "active" : ""}`}
            onClick={() => setTab("link")}
          >
            Link
          </button>
          <button
            className={`share-tab ${tab === "file" ? "active" : ""}`}
            onClick={() => setTab("file")}
          >
            File
          </button>
          <button
            className={`share-tab ${tab === "qr" ? "active" : ""}`}
            onClick={() => setTab("qr")}
          >
            QR Code
          </button>
        </div>

        <div className="share-body">
          {tab === "link" && (
            <div className="share-link-section">
              <p className="share-description">
                Copy this link and send it to someone. They can open it to import your contact card.
              </p>
              <div className="share-link-box">
                <code className="share-link-text">{shareLink}</code>
              </div>
              <button className="btn btn-primary share-copy-btn" onClick={handleCopy}>
                {copied ? "✓ Copied!" : "Copy Link"}
              </button>
            </div>
          )}

          {tab === "file" && (
            <div className="share-file-section">
              <p className="share-description">
                Download your contact card as a JSON file to share manually.
              </p>
              <div className="share-file-actions">
                <button className="btn btn-primary" onClick={onDownloadCard}>
                  Download Contact Card
                </button>
                <p className="share-hint">
                  Includes your inbox capability — share only with trusted contacts.
                </p>
                <button className="btn btn-secondary" onClick={onDownloadProfile}>
                  Download Public Profile
                </button>
                <p className="share-hint">
                  No inbox cap — safe to share publicly. Others can send you a contact request.
                </p>
              </div>
            </div>
          )}

          {tab === "qr" && (
            <div className="share-qr-section">
              <p className="share-description">
                Scan this QR code with a phone or camera to import the contact card.
              </p>
              {qrSvg ? (
                <div
                  className="share-qr-container"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <div className="share-qr-fallback">
                  QR code too large for this contact card. Use the link or file option instead.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
