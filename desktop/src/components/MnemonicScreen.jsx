// client/src/components/MnemonicScreen.jsx
// Shown immediately after enrollment to display the 12-word seed phrase.
//
// The user must check the confirmation checkbox before they can continue —
// this ensures they at least acknowledge the phrase exists before moving on.

import { useState } from "react";

export default function MnemonicScreen({ mnemonic, onContinue }) {
  const [confirmed, setConfirmed] = useState(false);
  const words = mnemonic ? mnemonic.trim().split(/\s+/) : [];

  return (
    <div className="login-screen">
      <div className="login-card" style={{ maxWidth: 540 }}>
        <div className="login-icon">◈</div>
        <h1 style={{ marginBottom: 4 }}>Save your recovery phrase</h1>
        <p className="login-subtitle" style={{ marginBottom: 20 }}>
          These 12 words can restore your complete identity — including your handle,
          keys, and inbox — if you ever lose your key file.
        </p>

        <div className="mnemonic-grid">
          {words.map((word, i) => (
            <div key={i} className="mnemonic-word">
              <span className="mnemonic-num">{i + 1}</span>
              <span className="mnemonic-text">{word}</span>
            </div>
          ))}
        </div>

        <div className="onboarding-section onboarding-warn" style={{ marginTop: 20 }}>
          <p className="onboarding-body">
            <strong>Write this down on paper.</strong> Do not screenshot it or store it in
            plaintext. If someone learns your phrase and your passphrase, they can
            impersonate you. If you lose both your key file <em>and</em> this phrase, your
            identity is gone permanently.
          </p>
        </div>

        <label className="mnemonic-confirm-label">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I've written down all 12 words in the correct order
        </label>

        <div className="enroll-actions" style={{ marginTop: 16 }}>
          <button
            className="btn btn-primary"
            disabled={!confirmed}
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
