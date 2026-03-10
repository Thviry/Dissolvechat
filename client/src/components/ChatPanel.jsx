// client/src/components/ChatPanel.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import { IconSend, IconAttach, IconClose, IconDownload, IconFile, IconCheck, IconCheckDouble, IconClock, IconRetry, IconAlert } from "./Icons";
import { fileToBase64, base64ToBlob, downloadBlob, formatFileSize } from "@utils/fileUtils";
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

export default function ChatPanel({ peer, group, messages, onSend, onGroupInfo, onRetry, onDismiss }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null); // { src, name }
  const fileInputRef = useRef(null);

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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  // Build flat list interleaved with date separator objects
  const items = useMemo(() => {
    const result = [];
    let lastDateStr = null;
    for (const msg of messages) {
      const d = new Date(msg.ts);
      const dateStr = d.toDateString();
      if (dateStr !== lastDateStr) {
        result.push({ type: "separator", key: `sep-${dateStr}`, label: formatDateChip(d) });
        lastDateStr = dateStr;
      }
      result.push({ type: "message", ...msg });
    }
    return result;
  }, [messages]);

  if (!peer && !group) {
    return (
      <main className="chat-panel">
        <div className="chat-empty">
          <div className="chat-empty-icon" aria-hidden="true">◈</div>
          <h2>Dissolve Chat</h2>
          <p>Select a contact or group to start a secure conversation</p>
        </div>
      </main>
    );
  }

  const canSend = group ? true : !!peer?.cap;

  return (
    <main className="chat-panel" onClick={handleChatClick}>
      {/* Header */}
      {group ? (
        <div className="chat-header" onClick={onGroupInfo} style={{ cursor: "pointer" }}>
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
          <div className="chat-header-avatar" aria-hidden="true">
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
              title="Cannot send messages — no inbox capability for this contact"
              role="status"
            >
              ⚠ No cap
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages" ref={scrollRef} role="log" aria-live="polite">
        <div className="chat-ephemeral-notice" role="note">
          ◇ End-to-end encrypted · Enable "Save messages locally" in settings to keep history
        </div>

        {messages.length === 0 ? (
          <div className="chat-no-messages">
            <span>No messages yet</span>
            <span style={{ fontSize: "11px" }}>
              {canSend ? "Send the first message below" : "No inbox capability — request one first"}
            </span>
          </div>
        ) : (
          items.map((item) =>
            item.type === "separator" ? (
              <div key={item.key} className="chat-date-separator" aria-label={`Messages from ${item.label}`}>
                <span className="chat-date-chip">{item.label}</span>
              </div>
            ) : (
              <React.Fragment key={item.msgId}>
              <div
                className={`chat-bubble ${item.dir === "out" ? "outgoing" : "incoming"}${item.status === "failed" ? " failed" : ""}${!seenRef.current?.has(item.msgId) ? " is-new" : ""}`}
              >
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
                {item.text && <div className="chat-bubble-text">{item.text}</div>}
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
          <input
            ref={inputRef}
            className="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={canSend ? "Type a message…" : "Cannot send — no inbox capability"}
            disabled={!canSend || sending}
            aria-label="Message input"
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
    </main>
  );
}
