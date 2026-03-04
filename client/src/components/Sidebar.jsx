// client/src/components/Sidebar.jsx
import { useState, useRef } from "react";
import ShareModal from "./ShareModal";
import { saveJson } from "../utils/storage";
import { IconSettings, IconLogout, IconClose, IconMore, IconSearch } from "./Icons";

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
  const RELAY_OFFICIAL = "https://relay.dissolve.chat";
  const RELAY_LOCAL    = "http://localhost:3001";

  const [lookupHandle, setLookupHandle] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [contactMenu, setContactMenu] = useState(null);
  const [relayCustomMode, setRelayCustomMode] = useState(() => {
    const url = identity.relayUrl || "";
    return url !== "" && url !== RELAY_OFFICIAL && url !== RELAY_LOCAL;
  });
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

      {/* ── Settings overlay (slides over full sidebar) ── */}
      {showSettings && (
        <div className="settings-overlay" role="dialog" aria-label="Settings">
          <div className="settings-overlay-header">
            <h3>Settings</h3>
            <button
              className="btn-icon"
              onClick={() => setShowSettings(false)}
              aria-label="Close settings"
            >
              <IconClose size={16} />
            </button>
          </div>
          <div className="settings-overlay-body">

            <div className="settings-section">
              <h4>Sharing</h4>
              <div className="settings-actions">
                <button className="btn btn-sm btn-primary" onClick={() => { setShowShare(true); setShowSettings(false); }}>
                  Share Contact
                </button>
                <label className="btn btn-sm btn-secondary" tabIndex={0}>
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
                <button className="btn btn-sm btn-secondary" onClick={onExportKeyfile}>
                  Export Keyfile
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h4>Privacy</h4>
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
                <span>Discoverable by handle</span>
              </label>
              {identity.discoverable && (
                <div style={{ marginTop: "6px" }}>
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
                  <div className="hint-text" style={{ marginTop: "4px" }}>
                    Lowercase letters, numbers, hyphens, underscores
                  </div>
                </div>
              )}
            </div>

            <div className="settings-section">
              <h4>Theme</h4>
              <div className="theme-picker" role="radiogroup" aria-label="Color theme">
                {[
                  { id: "",       label: "Midnight", color: "#6c8cff" },
                  { id: "ocean",  label: "Ocean",    color: "#4da6ff" },
                  { id: "forest", label: "Forest",   color: "#4dcc7a" },
                  { id: "ember",  label: "Ember",    color: "#ff8c4d" },
                  { id: "violet", label: "Violet",   color: "#a78bfa" },
                ].map((t) => {
                  const currentTheme = document.documentElement.getAttribute("data-theme") || "";
                  const isActive = currentTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      className={`theme-swatch${isActive ? " active" : ""}`}
                      style={{ background: t.color }}
                      title={t.label}
                      aria-label={t.label}
                      aria-pressed={isActive}
                      onClick={() => {
                        if (t.id) {
                          document.documentElement.setAttribute("data-theme", t.id);
                        } else {
                          document.documentElement.removeAttribute("data-theme");
                        }
                        saveJson(`theme:${identity.id}`, { theme: t.id });
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="settings-section">
              <h4>Relay</h4>
              {(() => {
                const current = identity.relayUrl || "";
                const activePreset =
                  !relayCustomMode && current === RELAY_OFFICIAL            ? "official" :
                  !relayCustomMode && (current === RELAY_LOCAL || !current) ? "local"    :
                  "custom";

                const setPreset = (url) => {
                  identity.setRelayUrl(url);
                  saveJson(`relay:${identity.id}`, { url });
                };

                return (
                  <>
                    <div className="relay-presets">
                      <button
                        type="button"
                        className={`btn btn-sm${activePreset === "official" ? " btn-primary" : " btn-secondary"}`}
                        onClick={() => { setRelayCustomMode(false); setPreset(RELAY_OFFICIAL); }}
                      >
                        Official
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm${activePreset === "local" ? " btn-primary" : " btn-secondary"}`}
                        onClick={() => { setRelayCustomMode(false); setPreset(RELAY_LOCAL); }}
                      >
                        Local
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm${activePreset === "custom" ? " btn-primary" : " btn-secondary"}`}
                        onClick={() => setRelayCustomMode(true)}
                      >
                        Custom
                      </button>
                    </div>

                    {activePreset === "custom" && (
                      <>
                        <input
                          className="input-field"
                          style={{ marginTop: "8px", fontSize: "12px" }}
                          value={current}
                          onChange={(e) => {
                            identity.setRelayUrl(e.target.value);
                            saveJson(`relay:${identity.id}`, { url: e.target.value });
                          }}
                          placeholder="https://your-relay.example.com"
                          aria-label="Custom relay URL"
                        />
                        <div className="hint-text" style={{ marginTop: "4px" }}>
                          Include protocol. e.g. https://relay.example.com
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* ── Identity header ── */}
      <div className="sidebar-header">
        <div className="identity-info">
          <div className="identity-avatar" aria-hidden="true">
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
            onClick={() => setShowSettings(true)}
            title="Settings"
            aria-label="Settings"
          >
            <IconSettings size={16} />
          </button>
          <button
            className="btn-icon"
            onClick={onLogout}
            title="Log out"
            aria-label="Log out"
          >
            <IconLogout size={16} />
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="sidebar-body">

        {/* Directory lookup */}
        <div className="sidebar-section">
          <div className="lookup-bar">
            <input
              className="input-field"
              value={lookupHandle}
              onChange={(e) => setLookupHandle(e.target.value)}
              placeholder="Find by handle…"
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              aria-label="Look up a handle"
            />
            <button
              className="btn btn-sm"
              onClick={handleLookup}
              disabled={lookupLoading || !lookupHandle.trim()}
              aria-label="Search"
            >
              {lookupLoading ? <span className="spinner" /> : <IconSearch size={14} />}
            </button>
          </div>
          {lookupResult && (
            <div className="lookup-result">
              <div className="lookup-result-info">
                <strong>{lookupResult.label || "(no label)"}</strong>
                <span className="lookup-result-id">{lookupResult.id?.slice(0, 16)}…</span>
              </div>
              <button className="btn btn-sm btn-primary" onClick={handleSendRequest}>
                Add
              </button>
            </div>
          )}
        </div>

        {/* Contacts */}
        <div className="sidebar-section">
          <h3 className="section-title">Contacts</h3>
          {contacts.length === 0 ? (
            <p className="empty-state">No contacts yet — look up a handle above</p>
          ) : (
            <div className="contact-list" role="list">
              {contacts.map((c) => (
                <div key={c.id} className="contact-item-wrap" role="listitem">
                  <button
                    className={`contact-item${c.id === activeId ? " active" : ""}`}
                    onClick={() => { onSelectPeer(c.id); setContactMenu(null); }}
                    aria-current={c.id === activeId ? "true" : undefined}
                  >
                    <div className="contact-accent-bar" aria-hidden="true" />
                    <div className="contact-avatar" aria-hidden="true">
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
                    aria-label={`Options for ${c.label}`}
                    aria-expanded={contactMenu === c.id}
                  >
                    <IconMore size={16} />
                  </button>
                  {contactMenu === c.id && (
                    <div className="contact-actions" role="menu">
                      <button
                        className="btn btn-sm btn-danger"
                        role="menuitem"
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
              <span className="badge" aria-label={`${requests.length} pending`}>{requests.length}</span>
            </h3>
            <div className="request-list">
              {requests.map((r) => (
                <div key={r.id} className="request-item">
                  <div className="request-header">
                    <div className="contact-avatar request-avatar" aria-hidden="true">
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
                    <button className="btn btn-sm btn-secondary" onClick={() => onRejectRequest(r.id)}>
                      Reject
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => onBlockPeer(r.id)}>
                      Block
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => onSelectPeer(r.id)}>
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>{/* end .sidebar-body */}

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        <div className="session-notice">
          <span aria-hidden="true">◇</span>
          Messages ephemeral · close tab to end session
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
