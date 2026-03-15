// client/src/components/ChatPanel.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import { IconSend, IconAttach, IconClose, IconDownload, IconFile, IconCheck, IconCheckDouble, IconClock, IconRetry, IconAlert, IconEmoji, IconCopy, IconPhone, IconPhoneMissed } from "./Icons";
import EmojiPicker from "./EmojiPicker";
import { parseLinks } from "@utils/linkify";
import { fileToBase64, base64ToBlob, downloadBlob, formatFileSize } from "@utils/fileUtils";
import { idToHue, formatCallDuration } from "@utils/callHelpers";
import { MAX_INLINE_FILE_SIZE, INLINE_IMAGE_TYPES } from "@config";

// Format a date for the separator chip
function formatDateChip(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function MessageStatus({ status }) {
  switch (status) {
    case "sending":
      return <span className="msg-status sending">Sending</span>;
    case "queued":
      return <span className="msg-status queued">Queued</span>;
    case "sent":
      return <span className="msg-status sent">Sent</span>;
    case "delivered":
      return <span className="msg-status delivered">Delivered</span>;
    case "failed":
      return <span className="msg-status failed">Failed</span>;
    default:
      return null;
  }
}

export default function ChatPanel({ className, isMobile, onBack, peer, group, messages, onSend, onGroupInfo, onRetry, onDismiss, identityId, onStartCall, callState, identity, contactCount, groupCount }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null); // { src, name }
  const fileInputRef = useRef(null);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [linkConfirm, setLinkConfirm] = useState(null);
  const [copiedMsgId, setCopiedMsgId] = useState(null);

  // Track which message IDs have already been rendered to avoid animating on mount
  // or when switching contacts/groups. seenRef.current is null until first render.
  const seenRef = useRef(null);
  const prevPeerRef = useRef(null);

  // When peer/group changes, reset seenRef so all existing messages are treated as seen
  const currentTarget = group?.groupId ?? peer?.id ?? null;
  if (currentTarget !== prevPeerRef.current) {
    prevPeerRef.current = currentTarget;
    seenRef.current = null;
  }

  // After each render, register all currently visible message IDs as seen
  useEffect(() => {
    const ids = new Set(seenRef.current ?? []);
    for (const msg of messages) ids.add(msg.msgId);
    seenRef.current = ids;
  });

  // Auto-scroll to bottom on new messages (only if already near bottom)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Track scroll position for FAB visibility
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollFab(gap > 200);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [currentTarget]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  };

  // Auto-focus message input when peer/group changes
  useEffect(() => {
    if ((peer?.cap || group) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [peer, group]);

  // Re-focus input on chat area click (unless clicking another input)
  const handleChatClick = (e) => {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA" && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleEmojiSelect = (emoji) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleLinkClick = (e, url) => {
    e.preventDefault();
    setLinkConfirm({ url });
  };

  const handleLinkConfirmOpen = () => {
    const url = linkConfirm.url;
    setLinkConfirm(null);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopy = async (msgId, msgText) => {
    try {
      await navigator.clipboard.writeText(msgText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = msgText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId((cur) => cur === msgId ? null : cur), 1500);
  };

  const renderMessageText = (messageText) => {
    const segments = parseLinks(messageText);
    return segments.map((seg, i) =>
      seg.type === "link" ? (
        <a
          key={i}
          className="chat-link"
          href={seg.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => handleLinkClick(e, seg.href)}
        >
          {seg.value}
        </a>
      ) : (
        <span key={i}>{seg.value}</span>
      )
    );
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const data = await fileToBase64(file);
      const previewUrl = INLINE_IMAGE_TYPES.has(file.type)
        ? URL.createObjectURL(file)
        : null;
      setPendingFile({ name: file.name, type: file.type, size: file.size, data, previewUrl });
    } catch (err) {
      setError("Failed to read file: " + err.message);
    }
  };

  const clearPendingFile = () => {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  };

  const handleDownload = (file) => {
    const blob = base64ToBlob(file.data, file.type);
    downloadBlob(blob, file.name);
  };

  const handleSend = async () => {
    const hasText = !!text.trim();
    const hasFile = !!pendingFile;
    const canSendMsg = group ? (hasText || hasFile) : ((hasText || hasFile) && !!peer);
    if (!canSendMsg || sending) return;

    if (hasFile && pendingFile.size > MAX_INLINE_FILE_SIZE) {
      setError(`File too large (max ${formatFileSize(MAX_INLINE_FILE_SIZE)}). Try a smaller file.`);
      return;
    }

    setError(null);
    setSending(true);
    try {
      const filePayload = hasFile
        ? { name: pendingFile.name, type: pendingFile.type, size: pendingFile.size, data: pendingFile.data }
        : undefined;
      await onSend(group ? group.groupId : peer.id, text, filePayload);
      setText("");
      clearPendingFile();
      if (inputRef.current) inputRef.current.style.height = "auto";
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  // Build flat list interleaved with date separator objects + grouping
  const items = useMemo(() => {
    const result = [];
    let lastDateStr = null;
    let prevSender = null;
    let prevTs = 0;
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const d = new Date(msg.ts);
      const dateStr = d.toDateString();
      if (dateStr !== lastDateStr) {
        result.push({ type: "separator", key: `sep-${dateStr}`, label: formatDateChip(d) });
        lastDateStr = dateStr;
        prevSender = null;
      }
      const sender = msg.dir === "out" ? "__self__" : (msg.senderId || msg.dir);
      const grouped = sender === prevSender && (msg.ts - prevTs) < 120000;

      // Look ahead to determine group position
      const nextMsg = messages[i + 1];
      const nextSender = nextMsg ? (nextMsg.dir === "out" ? "__self__" : (nextMsg.senderId || nextMsg.dir)) : null;
      const nextGrouped = nextMsg && sender === nextSender && (nextMsg.ts - msg.ts) < 120000;
      const nextDateStr = nextMsg ? new Date(nextMsg.ts).toDateString() : null;
      const nextIsNewDay = nextMsg && nextDateStr !== dateStr;

      let groupPos = null;
      if (grouped && (nextGrouped && !nextIsNewDay)) groupPos = "middle";
      else if (grouped && (!nextGrouped || nextIsNewDay)) groupPos = "last";
      else if (!grouped && (nextGrouped && !nextIsNewDay)) groupPos = "first";

      result.push({ type: "message", grouped, groupPos, ...msg });
      prevSender = sender;
      prevTs = msg.ts;
    }
    return result;
  }, [messages]);

  if (!peer && !group) {
    const avatarHue = (() => {
      try {
        const profile = JSON.parse(localStorage.getItem(`profile:${identityId}`) || "{}");
        if (profile.avatarColor && profile.avatarColor !== "auto") {
          const COLORS = { red: 0, orange: 30, amber: 45, green: 140, teal: 175, cyan: 190, blue: 220, indigo: 245, purple: 270, pink: 330 };
          return COLORS[profile.avatarColor] ?? idToHue(identityId);
        }
      } catch {}
      return idToHue(identityId);
    })();

    return (
      <main className={`chat-panel ${className || ""}`}>
        <div className="chat-empty identity-hub">
          <div className="identity-hub-glow" aria-hidden="true" />
          <div className="identity-hub-avatar" style={{ "--avatar-hue": avatarHue }}>
            {(identity?.handle || identity?.label || "?").charAt(0).toUpperCase()}
          </div>
          <div className="identity-hub-handle" style={{ animationDelay: "80ms" }}>
            {identity?.handle || identity?.label || "Anonymous"}
          </div>
          <div className="identity-hub-stats" style={{ animationDelay: "160ms" }}>
            {contactCount ?? 0} contact{contactCount !== 1 ? "s" : ""} · {groupCount ?? 0} group{groupCount !== 1 ? "s" : ""}
          </div>
          <div className="identity-hub-tags" style={{ animationDelay: "240ms" }}>
            <span className="identity-hub-tag accent">Encrypted</span>
            <span className="identity-hub-tag">P2P</span>
            <span className="identity-hub-tag">Anonymous</span>
          </div>
          <div className="identity-hub-motto" style={{ animationDelay: "320ms" }}>
            Power to the user, not the platform.
          </div>
        </div>
      </main>
    );
  }

  const canSend = group ? true : !!peer?.cap;

  return (
    <main className={`chat-panel ${className || ""}`} onClick={handleChatClick}>
      {/* Header */}
      {group ? (
        <div className="chat-header" onClick={onGroupInfo} style={{ cursor: "pointer" }}>
          {isMobile && (
            <button className="btn-icon chat-header-back" onClick={(e) => { e.stopPropagation(); onBack(); }} aria-label="Back to contacts">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10H5"/><path d="M10 5l-5 5 5 5"/></svg>
            </button>
          )}
          <div className="chat-header-avatar group-avatar" aria-hidden="true">
            {group.groupName[0].toUpperCase()}
          </div>
          <div className="chat-header-info">
            <div className="chat-header-name">{group.groupName}</div>
            <div className="chat-header-id">{group.members.length} members</div>
          </div>
        </div>
      ) : (
        <div className="chat-header">
          {isMobile && (
            <button className="btn-icon chat-header-back" onClick={onBack} aria-label="Back to contacts">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10H5"/><path d="M10 5l-5 5 5 5"/></svg>
            </button>
          )}
          <div className="chat-header-avatar" aria-hidden="true" data-hue style={{ "--avatar-hue": idToHue(peer.id) }}>
            {(peer.label || "?").charAt(0).toUpperCase()}
          </div>
          <div className="chat-header-info">
            <div className="chat-header-name">{peer.label}</div>
            <div className="chat-header-id" title={peer.id}>
              {peer.id.slice(0, 24)}…
            </div>
          </div>
          {!peer.cap && (
            <div
              className="chat-header-warning"
              title="Waiting for connection..."
              role="status"
            >
              ⚠ No cap
            </div>
          )}
          {peer && !group && onStartCall && (
            <button
              className="btn-icon chat-header-call"
              onClick={() => onStartCall(peer.id)}
              disabled={callState !== "idle"}
              title={callState !== "idle" ? "Already in a call" : "Start voice call"}
            >
              <IconPhone size={16} />
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="chat-messages" ref={scrollRef} role="log" aria-live="polite">
        <div className="chat-ephemeral-notice" role="note">
          ◇ End-to-end encrypted · Enable "Save messages locally" in settings to keep history
        </div>

        {messages.length === 0 ? (
          <div className="chat-no-messages">
            <span>No messages yet</span>
            <span style={{ fontSize: "11px" }}>
              {canSend ? "Send the first message below" : "Waiting for connection..."}
            </span>
          </div>
        ) : (
          items.map((item) =>
            item.type === "separator" ? (
              <div key={item.key} className="chat-date-separator" aria-label={`Messages from ${item.label}`}>
                <span className="chat-date-chip">{item.label}</span>
              </div>
            ) : item.t === "CallEvent" ? (
              <div key={item.callId} className={`call-event ${(item.reason === "timeout" || item.reason === "missed") ? "call-event-missed" : ""}`}>
                <span className="call-event-icon">
                  {(item.reason === "timeout" || item.reason === "missed") ? <IconPhoneMissed size={14} /> : <IconPhone size={14} />}
                </span>
                {item.reason === "hangup" && item.duration > 0
                  ? `Voice call — ${formatCallDuration(item.duration)}`
                  : item.reason === "decline"
                  ? "Call declined"
                  : item.reason === "busy"
                  ? "User busy"
                  : item.reason === "error"
                  ? "Call failed"
                  : item.direction === "inbound"
                  ? "Missed voice call"
                  : "No answer"}
              </div>
            ) : (
              <React.Fragment key={item.msgId}>
              <div
                className={`chat-bubble ${item.dir === "out" ? "outgoing" : "incoming"}${item.status === "failed" ? " failed" : ""}${!seenRef.current?.has(item.msgId) ? " is-new" : ""}${item.grouped ? " grouped" : ""}${item.groupPos ? ` msg-group-${item.groupPos}` : ""}`}
              >
                {item.text && (
                  <button
                    className={`chat-bubble-copy${copiedMsgId === item.msgId ? " copied" : ""}`}
                    onClick={(e) => { e.stopPropagation(); handleCopy(item.msgId, item.text); }}
                    aria-label="Copy message"
                    title={copiedMsgId === item.msgId ? "Copied!" : "Copy"}
                  >
                    {copiedMsgId === item.msgId ? <IconCheck size={12} /> : <IconCopy size={12} />}
                  </button>
                )}
                {group && item.dir === "in" && (
                  <span className="group-msg-sender">{item.senderLabel}</span>
                )}
                {item.file && INLINE_IMAGE_TYPES.has(item.file.type) && item.file.data && (
                  <div className="chat-file-card chat-file-image-card" onClick={() => setPreviewImage({ src: `data:${item.file.type};base64,${item.file.data}`, name: item.file.name })}>
                    <img
                      src={`data:${item.file.type};base64,${item.file.data}`}
                      alt={item.file.name}
                      className="chat-image-thumb"
                    />
                    <div className="chat-file-card-info">
                      <span className="chat-file-card-name">{item.file.name}</span>
                      <span className="chat-file-card-size">{formatFileSize(item.file.size)}</span>
                    </div>
                    <button
                      className="btn-icon"
                      onClick={(e) => { e.stopPropagation(); handleDownload(item.file); }}
                      aria-label={`Download ${item.file.name}`}
                      title="Download"
                    >
                      <IconDownload size={16} />
                    </button>
                  </div>
                )}
                {item.file && !INLINE_IMAGE_TYPES.has(item.file.type) && item.file.data && (
                  <div className="chat-file-card" onClick={() => handleDownload(item.file)}>
                    <IconFile size={20} />
                    <div className="chat-file-card-info">
                      <span className="chat-file-card-name">{item.file.name}</span>
                      <span className="chat-file-card-size">{formatFileSize(item.file.size)}</span>
                    </div>
                    <IconDownload size={16} />
                  </div>
                )}
                {item.file && !item.file.data && (
                  <div className="chat-file-card">
                    <IconFile size={20} />
                    <div className="chat-file-card-info">
                      <span className="chat-file-card-name">{item.file.name}</span>
                      <span className="chat-file-card-size">File unavailable</span>
                    </div>
                  </div>
                )}
                {item.text && <div className="chat-bubble-text">{renderMessageText(item.text)}</div>}
                <div className="chat-bubble-time" aria-label={new Date(item.ts).toLocaleString()}>
                  {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {item.dir === "out" && <MessageStatus status={item.status} />}
                </div>
              </div>
              {item.dir === "out" && item.status === "failed" && (
                <div className="msg-failed-actions">
                  <button className="msg-retry-btn" onClick={() => onRetry?.(item.msgId)}>
                    <IconRetry size={12} /> Retry
                  </button>
                  <button className="msg-dismiss-btn" onClick={() => onDismiss?.(item.msgId)}>
                    <IconClose size={12} />
                  </button>
                </div>
              )}
              </React.Fragment>
            )
          )
        )}
      </div>
      <button
        className={`scroll-fab${showScrollFab ? " visible" : ""}`}
        onClick={scrollToBottom}
        aria-label="Scroll to bottom"
        title="Scroll to bottom"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l4 4 4-4"/></svg>
      </button>
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        {error && (
          <div className="chat-error" role="alert">{error}</div>
        )}
        {pendingFile && (
          <div className="file-preview-bar">
            {pendingFile.previewUrl ? (
              <img src={pendingFile.previewUrl} alt={pendingFile.name} className="file-preview-thumb" />
            ) : (
              <div className="file-preview-icon"><IconFile size={20} /></div>
            )}
            <div className="file-preview-info">
              <span className="file-preview-name">{pendingFile.name}</span>
              <span className="file-preview-size">{formatFileSize(pendingFile.size)}</span>
            </div>
            <button className="btn-icon" onClick={clearPendingFile} aria-label="Remove attachment">
              <IconClose size={14} />
            </button>
          </div>
        )}
        <div className="chat-input-row">
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />
          <button
            className="btn-icon btn-attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canSend || sending}
            aria-label="Attach file"
            title="Attach file"
          >
            <IconAttach size={16} />
          </button>
          <div style={{ position: "relative" }}>
            <button
              className="btn-icon btn-emoji"
              onClick={() => setShowEmoji(!showEmoji)}
              disabled={!canSend || sending}
              aria-label="Emoji picker"
              title="Emoji"
            >
              <IconEmoji size={16} />
            </button>
            {showEmoji && (
              <EmojiPicker
                onSelect={handleEmojiSelect}
                identityId={identityId}
                onClose={() => setShowEmoji(false)}
              />
            )}
          </div>
          <textarea
            ref={inputRef}
            className="chat-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              // JS fallback for auto-grow if field-sizing not supported
              const el = e.target;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
            placeholder={canSend ? "Type a message…" : "Waiting for connection..."}
            disabled={!canSend || sending}
            aria-label="Message input"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            className="btn btn-primary btn-send"
            onClick={handleSend}
            disabled={(!text.trim() && !pendingFile) || !canSend || sending}
            aria-label="Send message"
          >
            {sending ? <span className="spinner" aria-hidden="true" /> : <IconSend size={15} />}
          </button>
        </div>
      </div>
      {/* Image preview modal */}
      {previewImage && (
        <div className="image-preview-overlay" onClick={() => setPreviewImage(null)}>
          <button className="image-preview-close btn-icon" onClick={() => setPreviewImage(null)} aria-label="Close preview">
            <IconClose size={20} />
          </button>
          <img
            src={previewImage.src}
            alt={previewImage.name}
            className="image-preview-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      {linkConfirm && (
        <div className="link-confirm-overlay" onClick={() => setLinkConfirm(null)}>
          <div className="link-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Opening external link</h3>
            <div className="link-confirm-url">{linkConfirm.url}</div>
            <p className="link-confirm-warn">You will leave Dissolve.</p>
            <div className="link-confirm-actions">
              <button className="btn btn-secondary" onClick={() => setLinkConfirm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleLinkConfirmOpen}>Open</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
