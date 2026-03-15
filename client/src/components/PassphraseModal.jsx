// client/src/components/PassphraseModal.jsx
// Replaces native prompt() for passphrase entry. Supports optional confirm field.
import { useState, useRef, useEffect } from "react";
import { IconClose, IconEye, IconEyeOff } from "./Icons";

export default function PassphraseModal({
  title,
  description,
  withConfirm = false,
  onConfirm,
  onCancel,
}) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [exiting, setExiting] = useState(false);
  const inputRef = useRef(null);

  const handleClose = () => { setExiting(true); setTimeout(onCancel, 150); };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const mismatch = withConfirm && confirmValue.length > 0 && passphrase !== confirmValue;
  const canConfirm =
    passphrase.length > 0 &&
    (!withConfirm || (confirmValue.length > 0 && passphrase === confirmValue));

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && canConfirm) onConfirm(passphrase);
    if (e.key === "Escape") handleClose();
  };

  return (
    <div
      className={`modal-overlay${exiting ? " exiting" : ""}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pp-modal-title"
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="pp-modal-title">{title}</h3>
          <button
            className="btn-icon modal-close"
            onClick={handleClose}
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
            <div className="password-field-wrap">
              <input
                ref={inputRef}
                id="pp-input"
                type={showPass ? "text" : "password"}
                className="input-field"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter passphrase…"
                onKeyDown={handleKeyDown}
                autoComplete={withConfirm ? "new-password" : "current-password"}
              />
              <button type="button" className="password-toggle" onClick={() => setShowPass(v => !v)} aria-label={showPass ? "Hide" : "Show"}>
                {showPass ? <IconEyeOff size={14} /> : <IconEye size={14} />}
              </button>
            </div>
          </div>

          {withConfirm && (
            <div className="form-group">
              <label className="form-label" htmlFor="pp-confirm">
                Confirm Passphrase
              </label>
              <div className="password-field-wrap">
                <input
                  id="pp-confirm"
                  type={showConfirm ? "text" : "password"}
                  className="input-field"
                  value={confirmValue}
                  onChange={(e) => setConfirmValue(e.target.value)}
                  placeholder="Type it again…"
                  onKeyDown={handleKeyDown}
                  autoComplete="new-password"
                />
                <button type="button" className="password-toggle" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? "Hide" : "Show"}>
                  {showConfirm ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                </button>
              </div>
              {mismatch && (
                <div className="form-hint status-taken">Passphrases don't match</div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button className="btn btn-secondary" type="button" onClick={handleClose}>
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
