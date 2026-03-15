// client/src/components/Sidebar.jsx
import { useState, useRef } from "react";
import ShareModal from "./ShareModal";
import LinkDeviceModal from "./LinkDeviceModal";
import { saveJson } from "@utils/storage";
import { idToHue } from "@utils/callHelpers";
import { IconSettings, IconLogout, IconClose, IconMore, IconSearch, IconPlus, IconGroup } from "./Icons";

function formatRelativeTime(ts) {
  if (!ts) return "";
  const now = new Date();
  const d = new Date(ts);
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);

  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const AVATAR_COLORS = [
  { id: "auto",    label: "Auto",    hue: null },
  { id: "red",     label: "Red",     hue: 0 },
  { id: "orange",  label: "Orange",  hue: 30 },
  { id: "amber",   label: "Amber",   hue: 45 },
  { id: "green",   label: "Green",   hue: 140 },
  { id: "teal",    label: "Teal",    hue: 175 },
  { id: "cyan",    label: "Cyan",    hue: 190 },
  { id: "blue",    label: "Blue",    hue: 220 },
  { id: "indigo",  label: "Indigo",  hue: 245 },
  { id: "purple",  label: "Purple",  hue: 270 },
  { id: "pink",    label: "Pink",    hue: 330 },
];

export default function Sidebar({
  className,
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
  onPresenceChange,
  onViewRecoveryPhrase,
  backupCompleted,
  shareCardData,
  onlineIds = {},
  groups = [],
  activeGroupId,
  onSelectGroup,
  onCreateGroup,
  unreadCounts = {},
  lastMessages = {},
}) {
  const RELAY_OFFICIAL = "https://relay.dissolve.chat";
  const RELAY_LOCAL    = "http://localhost:3001";

  const [lookupHandle, setLookupHandle] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsExiting, setSettingsExiting] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileExiting, setProfileExiting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showLinkDevice, setShowLinkDevice] = useState(false);
  const [contactMenu, setContactMenu] = useState(null);
  const [relayCustomMode, setRelayCustomMode] = useState(() => {
    const url = identity.relayUrl || "";
    return url !== "" && url !== RELAY_OFFICIAL && url !== RELAY_LOCAL;
  });
  const importRef = useRef(null);

  const closeSettings = () => { setSettingsExiting(true); setTimeout(() => { setShowSettings(false); setSettingsExiting(false); }, 200); };
  const closeProfile = () => { setProfileExiting(true); setTimeout(() => { setShowProfile(false); setProfileExiting(false); }, 200); };

  const saveProfile = (key, value) => {
    const current = {
      avatarColor: identity.avatarColor,
      fontSize: identity.fontSize,
      messageDensity: identity.messageDensity,
    };
    current[key] = value;
    saveJson(`profile:${identity.id}`, current);
  };

  // Resolve identity avatar hue
  const identityHue = identity.avatarColor
    ? AVATAR_COLORS.find(c => c.id === identity.avatarColor)?.hue ?? idToHue(identity.id)
    : idToHue(identity.id);

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
    <aside className={`sidebar ${className || ""}`}>

      {/* ── Settings overlay (slides over full sidebar) ── */}
      {showSettings && (
        <div className={`settings-overlay${settingsExiting ? " exiting" : ""}`} role="dialog" aria-label="Settings">
          <div className="settings-overlay-header">
            <h3>Settings</h3>
            <button
              className="btn-icon"
              onClick={closeSettings}
              aria-label="Close settings"
            >
              <IconClose size={16} />
            </button>
          </div>
          <div className="settings-overlay-body">

            <div className="settings-section">
              <h4>Sharing</h4>
              <div className="settings-actions">
                <button className="btn btn-sm btn-primary" onClick={() => { setShowShare(true); closeSettings(); }}>
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

            {!backupCompleted && (
            <div className="settings-section">
              <h4>Security</h4>
              <div className="settings-actions">
                <button className="btn btn-sm btn-secondary" onClick={onViewRecoveryPhrase}>
                  View Recovery Phrase
                </button>
              </div>
            </div>
            )}

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
                  checked={identity.soundEnabled}
                  onChange={(e) => {
                    identity.setSoundEnabled(e.target.checked);
                    saveJson(`sound:${identity.id}`, { enabled: e.target.checked });
                  }}
                />
                <span>Message notification sound</span>
              </label>
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={identity.showPresence}
                  onChange={(e) => onPresenceChange(e.target.checked)}
                />
                <span>Show online status</span>
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
                  { id: "",       label: "Terminal", color: "#39ff14" },
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
                            const url = e.target.value;
                            identity.setRelayUrl(url);
                            saveJson(`relay:${identity.id}`, { url });
                          }}
                          onBlur={(e) => {
                            const url = e.target.value.trim();
                            if (url && !url.startsWith("https://") && !url.startsWith("http://localhost")) {
                              addToast("Custom relay should use HTTPS for security", "warning");
                            }
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

            <div className="settings-section">
              <h4>Device</h4>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => { setShowLinkDevice(true); closeSettings(); }}
              >
                Link to Mobile
              </button>
              <div className="hint-text" style={{ marginTop: "4px" }}>
                Transfer your identity to the DissolveChat mobile app via QR code.
              </div>
            </div>

          </div>
        </div>
      )}

      {showLinkDevice && (
        <LinkDeviceModal
          identity={identity}
          onClose={() => setShowLinkDevice(false)}
        />
      )}

      {/* ── Profile overlay ── */}
      {showProfile && (
        <div className={`settings-overlay${profileExiting ? " exiting" : ""}`} role="dialog" aria-label="Profile">
          <div className="settings-overlay-header">
            <h3>Profile</h3>
            <button
              className="btn-icon"
              onClick={closeProfile}
              aria-label="Close profile"
            >
              <IconClose size={16} />
            </button>
          </div>
          <div className="settings-overlay-body">

            {/* Avatar preview */}
            <div className="profile-avatar-section">
              <div className="profile-avatar-preview" style={{ "--avatar-hue": identityHue }}>
                {identity.label.charAt(0).toUpperCase()}
              </div>
              <div className="profile-name">{identity.label}</div>
              <div className="profile-id">{identity.id.slice(0, 24)}…</div>
            </div>

            {/* Avatar color */}
            <div className="settings-section">
              <h4>Avatar Color</h4>
              <div className="avatar-color-grid">
                {AVATAR_COLORS.map((c) => {
                  const isActive = (identity.avatarColor || "auto") === c.id;
                  const swatchHue = c.hue ?? idToHue(identity.id);
                  return (
                    <button
                      key={c.id}
                      className={`avatar-color-swatch${isActive ? " active" : ""}`}
                      style={{ "--swatch-hue": swatchHue }}
                      title={c.label}
                      aria-label={c.label}
                      aria-pressed={isActive}
                      onClick={() => {
                        const val = c.id === "auto" ? null : c.id;
                        identity.setAvatarColor(val);
                        saveProfile("avatarColor", val);
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Font size */}
            <div className="settings-section">
              <h4>Font Size</h4>
              <div className="profile-option-group">
                {[
                  { id: "small", label: "Small" },
                  { id: "default", label: "Default" },
                  { id: "large", label: "Large" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    className={`btn btn-sm${identity.fontSize === opt.id ? " btn-primary" : " btn-secondary"}`}
                    onClick={() => {
                      identity.setFontSize(opt.id);
                      saveProfile("fontSize", opt.id);
                      document.documentElement.setAttribute("data-font-size", opt.id);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message density */}
            <div className="settings-section">
              <h4>Message Density</h4>
              <div className="profile-option-group">
                {[
                  { id: "compact", label: "Compact" },
                  { id: "default", label: "Default" },
                  { id: "spacious", label: "Spacious" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    className={`btn btn-sm${identity.messageDensity === opt.id ? " btn-primary" : " btn-secondary"}`}
                    onClick={() => {
                      identity.setMessageDensity(opt.id);
                      saveProfile("messageDensity", opt.id);
                      document.documentElement.setAttribute("data-density", opt.id);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Identity header ── */}
      <div className="sidebar-header">
        <div className="identity-info" onClick={() => setShowProfile(true)} style={{ cursor: "pointer" }} title="Open profile settings">
          <div className="identity-avatar" aria-hidden="true" style={{ "--avatar-hue": identityHue }}>
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
            <div className="empty-state-rich">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-state-icon">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <p>Look up a handle to start chatting</p>
            </div>
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
                    <div className="contact-avatar" aria-hidden="true" data-hue style={{ "--avatar-hue": idToHue(c.id) }}>
                      {(c.label || "?").charAt(0).toUpperCase()}
                      {onlineIds[c.id] && <span className="presence-dot" />}
                    </div>
                    <div className="contact-info">
                      <div className="contact-name-row">
                        <div className="contact-name">{c.label}</div>
                        {lastMessages[c.id]?.ts && (
                          <span className="contact-time">{formatRelativeTime(lastMessages[c.id].ts)}</span>
                        )}
                      </div>
                      {lastMessages[c.id]
                        ? <div className="contact-preview">{lastMessages[c.id].text}</div>
                        : <div className="contact-id">{c.id.slice(0, 20)}…</div>
                      }
                    </div>
                    {unreadCounts[c.id] > 0 && (
                      <span className="unread-badge">{unreadCounts[c.id]}</span>
                    )}
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

        {/* Groups */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <h3 className="section-title">Groups</h3>
            <button
              className="btn-icon"
              onClick={onCreateGroup}
              title="Create group"
              aria-label="Create group"
            >
              <IconPlus size={14} />
            </button>
          </div>
          {groups.length === 0 ? (
            <div className="empty-state-rich">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-state-icon">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <p>Create a group to chat with multiple people</p>
            </div>
          ) : (
            <div className="contact-list" role="list">
              {groups.map((g) => (
                <div key={g.groupId} className="contact-item-wrap" role="listitem">
                  <button
                    className={`contact-item${activeGroupId === g.groupId ? " active" : ""}`}
                    onClick={() => onSelectGroup(g.groupId)}
                    aria-current={activeGroupId === g.groupId ? "true" : undefined}
                  >
                    <div className="contact-accent-bar" aria-hidden="true" />
                    <div className="contact-avatar group-avatar" aria-hidden="true">
                      {g.groupName[0].toUpperCase()}
                    </div>
                    <div className="contact-info">
                      <div className="contact-name-row">
                        <div className="contact-name">{g.groupName}</div>
                        {lastMessages[g.groupId]?.ts && (
                          <span className="contact-time">{formatRelativeTime(lastMessages[g.groupId].ts)}</span>
                        )}
                      </div>
                      {lastMessages[g.groupId]
                        ? <div className="contact-preview">{lastMessages[g.groupId].text}</div>
                        : <div className="contact-id">{g.members.length} members</div>
                      }
                    </div>
                    {unreadCounts[g.groupId] > 0 && (
                      <span className="unread-badge">{unreadCounts[g.groupId]}</span>
                    )}
                  </button>
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
                    <div className="contact-avatar request-avatar" aria-hidden="true" data-hue style={{ "--avatar-hue": idToHue(r.id) }}>
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
