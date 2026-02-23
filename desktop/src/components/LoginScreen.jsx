// client/src/components/LoginScreen.jsx
import { useState, useRef } from "react";

export default function LoginScreen({ onLogin, onEnroll, onCheckHandle }) {
  const fileRef = useRef(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [handleStatus, setHandleStatus] = useState(null); // null | "checking" | "available" | "taken" | "error"
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState(null);
  const checkTimer = useRef(null);

  // Normalize handle input: lowercase, strip invalid chars, max 32
  const onHandleChange = (e) => {
    const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
    setHandle(clean);
    setHandleStatus(null);
    setEnrollError(null);

    // Debounced availability check
    clearTimeout(checkTimer.current);
    if (clean.length >= 2) {
      setHandleStatus("checking");
      checkTimer.current = setTimeout(async () => {
        try {
          const available = await onCheckHandle(clean);
          setHandleStatus(available ? "available" : "taken");
        } catch {
          setHandleStatus("error");
        }
      }, 400);
    }
  };

  const canSubmit =
    handle.length >= 2 &&
    handleStatus === "available" &&
    passphrase.length >= 4 &&
    passphrase === confirmPass &&
    !enrolling;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setEnrolling(true);
    setEnrollError(null);
    try {
      await onEnroll({ handle, displayName: displayName.trim() || handle, passphrase });
    } catch (err) {
      setEnrollError(err.message);
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-icon">◈</div>
        <h1>Dissolve</h1>
        <p className="login-subtitle">
          End-to-end encrypted messaging. Your identity is your key file.
        </p>

        {!showEnroll ? (
          <div className="login-actions">
            <button className="btn btn-primary" onClick={() => setShowEnroll(true)}>
              Create New Identity
            </button>

            <div className="login-divider">
              <span>or</span>
            </div>

            <label className="btn btn-secondary" tabIndex={0}>
              Load Key File
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onLogin(file);
                  e.target.value = "";
                }}
              />
            </label>

            <p className="login-hint">
              Select your <code>dissolve-*.usbkey.json</code> file
            </p>
          </div>
        ) : (
          <form className="enroll-form" onSubmit={handleSubmit}>
            {/* Handle (required, unique) */}
            <div className="form-group">
              <label className="form-label">
                Handle <span className="form-required">*</span>
              </label>
              <input
                className="input-field"
                value={handle}
                onChange={onHandleChange}
                placeholder="e.g. jonk"
                maxLength={32}
                autoFocus
              />
              <div className="form-hint">
                {!handle && "2-32 chars: lowercase letters, numbers, hyphens, underscores"}
                {handle && handle.length < 2 && "Too short — need at least 2 characters"}
                {handleStatus === "checking" && (
                  <span className="status-checking">Checking availability…</span>
                )}
                {handleStatus === "available" && (
                  <span className="status-available">✓ Available</span>
                )}
                {handleStatus === "taken" && (
                  <span className="status-taken">✗ Already taken — pick another</span>
                )}
                {handleStatus === "error" && (
                  <span className="status-error">Could not check — is the relay running?</span>
                )}
              </div>
            </div>

            {/* Display name (optional) */}
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                className="input-field"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={handle || "Optional — defaults to your handle"}
                maxLength={64}
              />
            </div>

            {/* Passphrase */}
            <div className="form-group">
              <label className="form-label">
                Passphrase <span className="form-required">*</span>
              </label>
              <input
                className="input-field"
                type="password"
                value={passphrase}
                onChange={(e) => { setPassphrase(e.target.value); setEnrollError(null); }}
                placeholder="Encrypts your key file"
              />
            </div>

            {/* Confirm passphrase */}
            <div className="form-group">
              <label className="form-label">
                Confirm Passphrase <span className="form-required">*</span>
              </label>
              <input
                className="input-field"
                type="password"
                value={confirmPass}
                onChange={(e) => { setConfirmPass(e.target.value); setEnrollError(null); }}
                placeholder="Type it again"
              />
              {confirmPass && passphrase !== confirmPass && (
                <div className="form-hint status-taken">Passphrases don't match</div>
              )}
              {passphrase && passphrase.length < 4 && (
                <div className="form-hint status-taken">At least 4 characters</div>
              )}
            </div>

            {enrollError && <div className="form-error">{enrollError}</div>}

            <div className="enroll-actions">
              <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
                {enrolling ? "Creating…" : "Create Identity"}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => { setShowEnroll(false); setEnrollError(null); }}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
