// client/src/components/ShareModal.jsx
import { useState, useMemo } from "react";
import { generateQRSvg } from "@utils/qrcode";
import { IconClose } from "./Icons";

export default function ShareModal({ cardData, onDownloadCard, onDownloadProfile, onClose }) {
  const [tab, setTab] = useState("link"); // link | file | qr
  const [copied, setCopied] = useState(false);

  // Build a shareable link with the contact card encoded as a URL-safe base64 fragment
  const shareLink = useMemo(() => {
    if (!cardData) return "";
    const json = JSON.stringify(cardData);
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${window.location.origin}#contact=${b64}`;
  }, [cardData]);

  const qrSvg = useMemo(() => {
    if (!shareLink) return null;
    try {
      return generateQRSvg(shareLink, 3, 4);
    } catch {
      return null;
    }
  }, [shareLink]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onKeyDown={handleKeyDown}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="share-modal-title">Share Contact</h3>
          <button className="btn-icon modal-close" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="share-tabs" role="tablist" aria-label="Share method">
          {[
            { id: "link", label: "Link" },
            { id: "file", label: "File" },
            { id: "qr",   label: "QR Code" },
          ].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`share-tab${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="share-body" role="tabpanel">
          {tab === "link" && (
            <div>
              <p className="share-description">
                Copy this link and send it to someone. They open it to import your contact card instantly.
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
            <div>
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
                Scan this QR code to import the contact card directly.
              </p>
              {qrSvg ? (
                <div
                  className="share-qr-container"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                  aria-label="QR code for contact card"
                />
              ) : (
                <div className="share-qr-fallback">
                  QR code too large for this contact card.<br />
                  Use the Link or File option instead.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
