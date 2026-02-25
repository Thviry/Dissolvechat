// desktop/src/components/OnboardingScreen.jsx
// Post-enrollment onboarding screen.
//
// Shown once after a new identity is created to explain:
// - The keyfile model and why it matters
// - That there is no account recovery — losing the file = losing the identity
// - Recommended backup practices

export default function OnboardingScreen({ onContinue, identity }) {
  return (
    <div className="login-screen">
      <div className="login-card" style={{ maxWidth: 520 }}>
        <div className="login-icon">◈</div>
        <h1 style={{ marginBottom: 4 }}>Identity created</h1>
        <p className="login-subtitle" style={{ marginBottom: 24 }}>
          Before you start chatting, there are a few things you need to know.
        </p>

        <div className="onboarding-section">
          <h3 className="onboarding-heading">Your key file IS your identity</h3>
          <p className="onboarding-body">
            Dissolve has no passwords, no servers that know who you are, and no account
            recovery. Your cryptographic key file — the{" "}
            <code>.usbkey.json</code> file just downloaded — is the only proof of your
            identity. Anyone who has it (and your passphrase) can be you.
          </p>
        </div>

        <div className="onboarding-section onboarding-warn">
          <h3 className="onboarding-heading">⚠ Losing your key file = losing your identity forever</h3>
          <p className="onboarding-body">
            There is no "forgot password" flow. There is no support team that can reset
            your account. If you lose the key file and have no backup, that identity is
            gone permanently. Your contacts will not be able to reach you on that handle
            again.
          </p>
        </div>

        <div className="onboarding-section">
          <h3 className="onboarding-heading">Back it up — right now</h3>
          <p className="onboarding-body">
            Keep copies in at least two separate places:
          </p>
          <ul className="onboarding-list">
            <li>A USB drive or encrypted external disk</li>
            <li>An encrypted folder in cloud storage (iCloud, Dropbox, etc.)</li>
            <li>A password manager that can store file attachments</li>
          </ul>
          <p className="onboarding-body" style={{ marginTop: 8 }}>
            You can always re-export your key file from Settings → Export Key File if
            you need another copy later.
          </p>
        </div>

        <div className="onboarding-section">
          <h3 className="onboarding-heading">What the relay can (and can't) see</h3>
          <p className="onboarding-body">
            The relay routes encrypted envelopes between users. It never sees message
            content, sender identity, or recipient identity — only an opaque ciphertext
            blob and an inbox token. Even if the relay were compromised, your messages
            remain private.
          </p>
        </div>

        <div className="enroll-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-primary" onClick={onContinue}>
            I've backed up my key file — let's go
          </button>
        </div>
      </div>
    </div>
  );
}
