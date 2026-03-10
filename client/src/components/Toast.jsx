// client/src/components/Toast.jsx
// Renders the toast stack. Mount once in App. Receives toasts from useToast().
export default function ToastContainer({ toasts }) {
  if (!toasts.length) return null;

  const icons = { success: "✓", error: "✕", warning: "!", info: "◈" };

  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}${t.exiting ? " toast-exiting" : ""}`} role="alert">
          <span className="toast-icon" aria-hidden="true">{icons[t.type] ?? "◈"}</span>
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
