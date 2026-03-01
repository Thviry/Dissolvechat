// client/src/components/LoginScreen.jsx
import { useState, useRef } from "react";
import { validateMnemonic } from "dissolve-core/crypto/seed";

export default function LoginScreen({ onLogin, onEnroll, onCheckHandle, onRecover }) {
  const fileRef = useRef(null);
  const [view, setView] = useState("home"); // home | enroll | recover

  // ── Enrollment state ────────────────────────────────────────────────
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [handleStatus, setHandleStatus] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState(null);
  const checkTimer = useRef(null);

  // ── Recovery state ──────────────────────────────────────────────────
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [recoveryName, setRecoveryName] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [recoverError, setRecoverError] = useState(null);

  const onHandleChange = (e) => {
    const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
    setHandle(clean);
    setHandleStatus(null);
    setEnrollError(null);

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

  const handleEnrollSubmit = async (e) => {
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

  const phraseWords = recoveryPhrase.trim().split(/\s+/).filter(Boolean);
  const phraseValid = phraseWords.length === 12 && validateMnemonic(recoveryPhrase);
  const canRecover = phraseValid && !recovering;

  const handleRecoverSubmit = async (e) => {
    e.preventDefault();
    if (!canRecover) return;
    setRecovering(true);
    setRecoverError(null);
    try {
      await onRecover(recoveryPhrase.trim(), recoveryName.trim());
    } catch (err) {
      setRecoverError(err.message);
    } finally {
      setRecovering(false);
    }
  };

  const backToHome = () => {
    setView("home");
    setEnrollError(null);
    setRecoverError(null);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-icon">◈</div>
        <h1>Dissolve</h1>
        <p className="login-subtitle">
          End-to-end encrypted messaging. No accounts. No servers that know who you are.
        </p>

        {view === "home" && (
          <div className="login-actions">
            <button className="btn btn-primary" onClick={() => setView("enroll")}>
              Create New Identity
            </button>

            <div className="login-divider"><span>or</span></div>

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

            <div className="login-divider"><span>or</span></div>

            <button className="btn btn-ghost" onClick={() => setView("recover")}>
              Recover from Seed Phrase
            </button>

            <div className="login-threat-model">
              <details>
                <summary className="threat-model-summary">How does this work?</summary>
                <div className="threat-model-body">
                  <p><strong>Your key file is your identity.</strong> It contains encrypted private keys
                  that prove who you are. No username or password is stored on any server.</p>
                  <p><strong>End-to-end encrypted.</strong> Messages are encrypted on your device before
                  leaving it. The relay only forwards opaque ciphertext — it cannot read your messages.</p>
                  <p><strong>12-word recovery phrase.</strong> New identities come with a seed phrase
                  that can fully restore your identity if you lose your key file. Write it down.</p>
                  <p><strong>Self-hostable.</strong> You can run your own relay and point Dissolve at it
                  from Settings. You do not have to trust anyone else's infrastructure.</p>
                </div>
              </details>
            </div>
          </div>
        )}

        {view === "enroll" && (
          <form className="enroll-form" onSubmit={handleEnrollSubmit}>
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
                <div className="form-hint status-taken">Passphrases do not match</div>
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
              <button className="btn btn-secondary" type="button" onClick={backToHome}>
                Back
              </button>
            </div>
          </form>
        )}

        {view === "recover" && (
          <form className="enroll-form" onSubmit={handleRecoverSubmit}>
            <div className="form-group">
              <label className="form-label">
                Recovery Phrase <span className="form-required">*</span>
              </label>
              <textarea
                className="input-field"
                style={{ minHeight: 80, resize: "vertical" }}
                value={recoveryPhrase}
                onChange={(e) => { setRecoveryPhrase(e.target.value); setRecoverError(null); }}
                placeholder="Enter your 12 words separated by spaces"
                autoFocus
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
              />
              <div className="form-hint">
                {phraseWords.length === 0 && "Enter the 12 words from your recovery phrase"}
                {phraseWords.length > 0 && phraseWords.length < 12 && (
                  <span className="status-checking">{phraseWords.length} / 12 words</span>
                )}
                {phraseWords.length === 12 && phraseValid && (
                  <span className="status-available">✓ Valid recovery phrase</span>
                )}
                {phraseWords.length === 12 && !phraseValid && (
                  <span className="status-taken">✗ Invalid phrase — check for typos</span>
                )}
                {phraseWords.length > 12 && (
                  <span className="status-taken">Too many words</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                className="input-field"
                value={recoveryName}
                onChange={(e) => setRecoveryName(e.target.value)}
                placeholder="Optional — how you appear to contacts"
                maxLength={64}
              />
            </div>

            {recoverError && <div className="form-error">{recoverError}</div>}

            <div className="enroll-actions">
              <button className="btn btn-primary" type="submit" disabled={!canRecover}>
                {recovering ? "Recovering…" : "Recover Identity"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={backToHome}>
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
