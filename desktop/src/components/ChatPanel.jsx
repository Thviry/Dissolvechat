// client/src/components/ChatPanel.jsx
import { useState, useRef, useEffect } from "react";

export default function ChatPanel({ peer, messages, onSend }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
    <main className="chat-panel">
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
          ◇ Messages are ephemeral — they vanish when you close or refresh this tab.
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
