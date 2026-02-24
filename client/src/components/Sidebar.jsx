// client/src/components/Sidebar.jsx
import { useState, useRef } from "react";
import ShareModal from "./ShareModal";
import { saveJson } from "../utils/storage";

export default function Sidebar({
  identity,
  contacts,
  requests,
  activeId,
  onSelectPeer,
  onExportCard,
  onExportProfile,
  onImportContact,
  onAcceptRequest,
  onRejectRequest,
  onBlockPeer,
  onLookup,
  onSendRequest,
  onLogout,
  onExportKeyfile,
  onDiscoverabilityChange,
  shareCardData,
}) {
  const [lookupHandle, setLookupHandle] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [contactMenu, setContactMenu] = useState(null);
  const importRef = useRef(null);

  const handleLookup = async () => {
    if (!lookupHandle.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    const result = await onLookup(lookupHandle.trim().toLowerCase());
    setLookupResult(result);
    setLookupLoading(false);
  };

  const handleSendRequest = async () => {
    if (!lookupResult) return;
    await onSendRequest(lookupResult);
    setLookupResult(null);
    setLookupHandle("");
  };

  return (
    <aside className="sidebar">
      {/* Identity header */}
      <div className="sidebar-header">
        <div className="identity-info">
          <div className="identity-avatar">
            {identity.label.charAt(0).toUpperCase()}
          </div>
          <div className="identity-details">
            <div className="identity-name">{identity.label}</div>
            <div className="identity-id" title={identity.id}>
              {identity.id.slice(0, 16)}…
            </div>
          </div>
        </div>
        <div className="sidebar-header-actions">
          <button
            className="btn-icon"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            ⚙
          </button>
          <button className="btn btn-secondary" onClick={onExportKeyfile}>
                  Export Keyfile (with contacts)
                </button>
          <button className="btn-icon" onClick={onLogout} title="Logout">
            ⏻
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-section">
            <h4>Sharing</h4>
            <div className="settings-actions">
              <button className="btn btn-sm btn-primary" onClick={() => setShowShare(true)}>
                Share Contact
              </button>
              <label className="btn btn-sm" tabIndex={0}>
                Import Contact
                <input
                  ref={importRef}
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) onImportContact(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h4>Discoverability</h4>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={identity.archiveEnabled}
                onChange={(e) => {
                  identity.setArchiveEnabled(e.target.checked);
                  saveJson(`archive:${identity.id}`, { enabled: e.target.checked });
                }}
              />
              <span>Save messages locally (encrypted)</span>
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={identity.discoverable}
                onChange={(e) => onDiscoverabilityChange(e.target.checked, identity.handle)}
              />
              <span>Let people find me by handle</span>
            </label>
            {identity.discoverable && (
              <div>
                <input
                  className="input-field"
                  value={identity.handle}
                  onChange={(e) => {
                    const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
                    onDiscoverabilityChange(identity.discoverable, clean);
                  }}
                  placeholder="e.g. alice"
                  maxLength={32}
                />
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                  Lowercase letters, numbers, hyphens, underscores only
                </div>
              </div>
            )}
          </div>

          <div className="settings-section">
            <h4>Relay</h4>
            <input
              className="input-field"
              value={identity.relayUrl || ""}
              onChange={(e) => {
                identity.setRelayUrl(e.target.value);
                saveJson(`relay:${identity.id}`, { url: e.target.value });
              }}
              placeholder="Default (localhost:3001)"
              style={{ fontSize: "12px" }}
            />
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
              Custom relay URL (e.g. https://relay.example.com). Leave blank for default.
            </div>
          </div>
        </div>
      )}

      {/* Lookup & request */}
      <div className="sidebar-section">
        <div className="lookup-bar">
          <input
            className="input-field"
            value={lookupHandle}
            onChange={(e) => setLookupHandle(e.target.value)}
            placeholder="Look up a handle…"
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          />
          <button className="btn btn-sm" onClick={handleLookup} disabled={lookupLoading}>
            {lookupLoading ? "…" : "Go"}
          </button>
        </div>
        {lookupResult && (
          <div className="lookup-result">
            <div className="lookup-result-info">
              <strong>{lookupResult.label || "(no label)"}</strong>
              <span className="lookup-result-id">{lookupResult.id?.slice(0, 16)}…</span>
            </div>
            <button className="btn btn-sm btn-primary" onClick={handleSendRequest}>
              Send Request
            </button>
          </div>
        )}
      </div>

      {/* Contacts */}
      <div className="sidebar-section">
        <h3 className="section-title">Contacts</h3>
        {contacts.length === 0 ? (
          <p className="empty-state">No contacts yet</p>
        ) : (
          <div className="contact-list">
            {contacts.map((c) => (
              <div key={c.id} className="contact-item-wrap">
                <button
                  className={`contact-item ${c.id === activeId ? "active" : ""}`}
                  onClick={() => onSelectPeer(c.id)}
                >
                  <div className="contact-avatar">
                    {(c.label || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="contact-info">
                    <div className="contact-name">{c.label}</div>
                    <div className="contact-id">{c.id.slice(0, 20)}…</div>
                  </div>
                </button>
                <button
                  className="btn-icon contact-menu-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setContactMenu(contactMenu === c.id ? null : c.id);
                  }}
                  title="Options"
                >
                  ⋮
                </button>
                {contactMenu === c.id && (
                  <div className="contact-actions">
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => { onBlockPeer(c.id); setContactMenu(null); }}
                    >
                      Block
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Requests */}
      {requests.length > 0 && (
        <div className="sidebar-section">
          <h3 className="section-title">
            Requests
            <span className="badge">{requests.length}</span>
          </h3>
          <div className="request-list">
            {requests.map((r) => (
              <div key={r.id} className="request-item">
                <div className="request-header">
                  <div className="contact-avatar request-avatar">
                    {(r.label || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="contact-info">
                    <div className="contact-name">{r.label}</div>
                    {r.lastMessagePreview && (
                      <div className="request-preview">"{r.lastMessagePreview}"</div>
                    )}
                  </div>
                </div>
                <div className="request-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => onAcceptRequest(r.id)}>
                    Accept
                  </button>
                  <button className="btn btn-sm" onClick={() => onRejectRequest(r.id)}>
                    Reject
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => onBlockPeer(r.id)}>
                    Block
                  </button>
                  <button className="btn btn-sm" onClick={() => onSelectPeer(r.id)}>
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session lifecycle notice */}
      <div className="sidebar-footer">
        <div className="session-notice">
          <span className="session-notice-icon">◇</span>
          <span>Session persists across refresh. Closing the tab or logging out ends your session. Messages are archived locally (encrypted). Contacts persist locally.</span>
        </div>
      </div>

      {/* Share modal */}
      {showShare && (
        <ShareModal
          cardData={shareCardData}
          onDownloadCard={onExportCard}
          onDownloadProfile={onExportProfile}
          onClose={() => setShowShare(false)}
        />
      )}
    </aside>
  );
}
