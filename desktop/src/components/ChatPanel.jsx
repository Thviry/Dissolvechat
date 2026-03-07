// client/src/components/ChatPanel.jsx
import { useState, useRef, useEffect, useMemo } from "react";
import { IconSend } from "./Icons";

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

export default function ChatPanel({ peer, group, messages, onSend, onGroupInfo }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

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

  const handleSend = async () => {
    const canSend = group ? !!text.trim() : (!!text.trim() && !!peer);
    if (!canSend || sending) return;
    setError(null);
    setSending(true);
    try {
      await onSend(group ? group.groupId : peer.id, text);
      setText("");
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
              <div
                key={item.msgId}
                className={`chat-bubble ${item.dir === "out" ? "outgoing" : "incoming"}${!seenRef.current?.has(item.msgId) ? " is-new" : ""}`}
              >
                {group && item.dir === "in" && (
                  <span className="group-msg-sender">{item.senderLabel}</span>
                )}
                <div className="chat-bubble-text">{item.text}</div>
                <div className="chat-bubble-time" aria-label={new Date(item.ts).toLocaleString()}>
                  {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            )
          )
        )}
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        {error && (
          <div className="chat-error" role="alert">{error}</div>
        )}
        <div className="chat-input-row">
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
            disabled={!text.trim() || !canSend || sending}
            aria-label="Send message"
          >
            {sending ? <span className="spinner" aria-hidden="true" /> : <IconSend size={15} />}
          </button>
        </div>
      </div>
    </main>
  );
}
