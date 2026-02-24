// client/src/components/ChatPanel.jsx
import { useState, useRef, useEffect } from "react";

export default function ChatPanel({ peer, messages, onSend }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-focus message input when peer changes or on mount
  useEffect(() => {
    if (peer?.cap && inputRef.current) {
      inputRef.current.focus();
    }
  }, [peer]);

  // Re-focus message input when clicking anywhere in chat (unless clicking another input)
  const handleChatClick = (e) => {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA" && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSend = async () => {
    if (!text.trim() || !peer || sending) return;
    setError(null);
    setSending(true);
    try {
      await onSend(peer.id, text);
      setText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (!peer) {
    return (
      <main className="chat-panel">
        <div className="chat-empty">
          <div className="chat-empty-icon">◈</div>
          <h2>Dissolve Chat</h2>
          <p>Select a contact to start messaging</p>
        </div>
      </main>
    );
  }

  return (
    <main className="chat-panel" onClick={handleChatClick}>
      <div className="chat-header">
        <div className="chat-header-avatar">
          {(peer.label || "?").charAt(0).toUpperCase()}
        </div>
        <div className="chat-header-info">
          <div className="chat-header-name">{peer.label}</div>
          <div className="chat-header-id" title={peer.id}>
            {peer.id.slice(0, 24)}…
          </div>
        </div>
        {!peer.cap && (
          <div className="chat-header-warning" title="Cannot send — no inbox capability">
            ⚠ No cap
          </div>
        )}
      </div>

      <div className="chat-messages" ref={scrollRef}>
        <div className="chat-ephemeral-notice">
          ◇ End-to-end encrypted. Enable "Save messages locally" in settings to keep history.
        </div>
        {messages.length === 0 ? (
          <div className="chat-no-messages">No messages yet</div>
        ) : (
          messages.map((m) => (
            <div
              key={m.msgId}
              className={`chat-bubble ${m.dir === "out" ? "outgoing" : "incoming"}`}
            >
              <div className="chat-bubble-text">{m.text}</div>
              <div className="chat-bubble-time">
                {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="chat-input-area">
        {error && <div className="chat-error">{error}</div>}
        <div className="chat-input-row">
          <input
            ref={inputRef}
            className="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={peer.cap ? "Type a message…" : "Cannot send (no inbox cap)"}
            disabled={!peer.cap || sending}
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
            disabled={!text.trim() || !peer.cap || sending}
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}
