// client/src/components/PassphraseModal.jsx
// Replaces native prompt() for passphrase entry. Supports optional confirm field.
import { useState, useRef, useEffect } from "react";
import { IconClose } from "./Icons";

export default function PassphraseModal({
  title,
  description,
  withConfirm = false,
  onConfirm,
  onCancel,
}) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const mismatch = withConfirm && confirmValue.length > 0 && passphrase !== confirmValue;
  const canConfirm =
    passphrase.length > 0 &&
    (!withConfirm || (confirmValue.length > 0 && passphrase === confirmValue));

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && canConfirm) onConfirm(passphrase);
    if (e.key === "Escape") onCancel();
  };

  return (
    <div
      className="modal-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pp-modal-title"
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="pp-modal-title">{title}</h3>
          <button
            className="btn-icon modal-close"
            onClick={onCancel}
            aria-label="Cancel"
            type="button"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="modal-body">
          {description && <p className="modal-desc">{description}</p>}

          <div className="form-group">
            <label className="form-label" htmlFor="pp-input">
              Passphrase
            </label>
            <input
              ref={inputRef}
              id="pp-input"
              type="password"
              className="input-field"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter passphrase…"
              onKeyDown={handleKeyDown}
              autoComplete={withConfirm ? "new-password" : "current-password"}
            />
          </div>

          {withConfirm && (
            <div className="form-group">
              <label className="form-label" htmlFor="pp-confirm">
                Confirm Passphrase
              </label>
              <input
                id="pp-confirm"
                type="password"
                className="input-field"
                value={confirmValue}
                onChange={(e) => setConfirmValue(e.target.value)}
                placeholder="Type it again…"
                onKeyDown={handleKeyDown}
                autoComplete="new-password"
              />
              {mismatch && (
                <div className="form-hint status-taken">Passphrases don't match</div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button className="btn btn-secondary" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => onConfirm(passphrase)}
              disabled={!canConfirm}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
