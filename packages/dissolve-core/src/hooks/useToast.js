// dissolve-core/src/hooks/useToast.js
// Lightweight toast notification hook. No external dependencies.
import { useState, useCallback } from "react";

let nextId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info", duration = 3500) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type, exiting: false }]);
    // Start exit animation before removal
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
    }, Math.max(0, duration - 300));
    // Remove after exit animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return { toasts, addToast };
}
