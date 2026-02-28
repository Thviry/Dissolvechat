// client/src/App.jsx
// Dissolve Chat v5 — Protocol-first E2EE messenger.
//
// Architecture:
// - Identity, contacts, and messaging are managed by dedicated hooks.
// - Crypto is isolated in src/crypto/.
// - Protocol/relay communication is in src/protocol/.
// - UI is composed of focused components.
// - alert()/prompt() have been replaced with Toast + PassphraseModal.

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useIdentity } from "./hooks/useIdentity";
import { useContacts } from "./hooks/useContacts";
import { useMessaging } from "./hooks/useMessaging";
import { useToast } from "./hooks/useToast";
import { capHashFromCap } from "./crypto";
import { signObject } from "./crypto/signing";
import { downloadJson, saveJson } from "./utils/storage";
import { lookupDirectory as relayLookup, blockOnRelay } from "./protocol/relay";
import { buildBlockRequest } from "./protocol/envelopes";
import LoginScreen from "./components/LoginScreen";
import MnemonicScreen from "./components/MnemonicScreen";
import OnboardingScreen from "./components/OnboardingScreen";
import Sidebar from "./components/Sidebar";
import ChatPanel from "./components/ChatPanel";
import ToastContainer from "./components/Toast";
import PassphraseModal from "./components/PassphraseModal";
import "./App.css";

export default function App() {
  const [mode, setMode] = useState("login"); // login | mnemonic | onboarding | chat
  const [pendingMnemonic, setPendingMnemonic] = useState(null);

  const identity = useIdentity();
  const contactsMgr = useContacts(identity.id);
  const messaging = useMessaging(identity, contactsMgr);
  const { toasts, addToast } = useToast();

  // --- Passphrase modal (replaces native prompt()) ---
  const passphraseResolverRef = useRef(null);
  const [passphraseState, setPassphraseState] = useState(null);

  const requestPassphrase = useCallback((title, description, withConfirm = false) => {
    return new Promise((resolve, reject) => {
      passphraseResolverRef.current = { resolve, reject };
      setPassphraseState({ title, description, withConfirm });
    });
  }, []);

  const handlePassphraseConfirm = useCallback((value) => {
    passphraseResolverRef.current?.resolve(value);
    passphraseResolverRef.current = null;
    setPassphraseState(null);
  }, []);

  const handlePassphraseCancel = useCallback(() => {
    passphraseResolverRef.current?.reject(new Error("cancelled"));
    passphraseResolverRef.current = null;
    setPassphraseState(null);
  }, []);

  // Auto-switch to chat mode when session is restored from sessionStorage
  useEffect(() => {
    if (identity.sessionChecked && identity.isReady && mode === "login") {
      setMode("chat");
    }
  }, [identity.sessionChecked, identity.isReady, mode]);

  // --- Auto-import contact from URL fragment (#contact=base64) ---
  useEffect(() => {
    if (!identity.isReady) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#contact=")) return;
    try {
      const b64 = hash.slice("#contact=".length);
      const json = decodeURIComponent(escape(atob(b64.replace(/-/g, "+").replace(/_/g, "/"))));
      const card = JSON.parse(json);
      if (card?.id && card?.authPublicJwk && card?.e2eePublicJwk && card.id !== identity.id) {
        contactsMgr.addContact({
          id: card.id,
          label: card.label || "Contact",
          authPublicJwk: card.authPublicJwk,
          e2eePublicJwk: card.e2eePublicJwk,
          cap: typeof card.cap === "string" ? card.cap : null,
        });
        window.history.replaceState(null, "", window.location.pathname);
        addToast(`Contact "${card.label || card.id.slice(0, 12)}" imported!`, "success");
      }
    } catch { /* ignore malformed fragments */ }
  }, [identity.isReady, identity.id, contactsMgr, addToast]);

  // --- Export keyfile ---
  const handleExportKeyfile = useCallback(async () => {
    let passphrase;
    try {
      passphrase = await requestPassphrase(
        "Export Key File",
        "Choose a passphrase to encrypt your key file. You will need it to log in on another device.",
        true /* withConfirm */
      );
    } catch {
      return; // user cancelled
    }
    try {
      await identity.exportKeyfile(passphrase, contactsMgr.contacts);
      addToast("Key file exported successfully.", "success");
    } catch (err) {
      addToast("Export failed: " + err.message, "error");
    }
  }, [identity, contactsMgr, requestPassphrase, addToast]);

  // --- Check handle availability (called from LoginScreen during enrollment) ---
  const handleCheckHandle = useCallback(async (handle) => {
    const { checkHandleAvailable } = await import("./protocol/relay");
    return checkHandleAvailable(handle);
  }, []);

  // --- Enroll ---
  const handleEnroll = useCallback(async ({ handle, displayName, passphrase }) => {
    if (!passphrase) throw new Error("Passphrase required");
    if (!handle || handle.length < 2) throw new Error("Handle required (2+ chars)");

    const stillAvailable = await handleCheckHandle(handle);
    if (!stillAvailable) throw new Error("Handle was just taken — pick another");

    try {
      const { mnemonic } = await identity.enroll(displayName || handle, passphrase, handle);
      setPendingMnemonic(mnemonic);
      setMode("mnemonic");
    } catch (err) {
      throw new Error("Enrollment failed: " + err.message);
    }
  }, [identity, handleCheckHandle]);

  // --- Recover ---
  const handleRecover = useCallback(async (mnemonic, displayName) => {
    try {
      await identity.recover(mnemonic, displayName);
      setMode("chat");
    } catch (err) {
      throw new Error("Recovery failed: " + err.message);
    }
  }, [identity]);

  // --- Login ---
  const handleLogin = useCallback(async (file) => {
    if (!file) return;
    let passphrase;
    try {
      passphrase = await requestPassphrase(
        "Enter Passphrase",
        "Enter the passphrase that protects your key file."
      );
    } catch {
      return; // user cancelled
    }
    try {
      const raw = await file.text();
      const result = await identity.login(raw, passphrase);
      if (result?.importedContacts?.length > 0) {
        for (const c of result.importedContacts) {
          if (c.id && c.authPublicJwk && c.e2eePublicJwk) {
            contactsMgr.addContact(c);
          }
        }
      }
      setMode("chat");
    } catch (err) {
      addToast("Login failed: " + (err.message || "Wrong passphrase or corrupted file."), "error");
    }
  }, [identity, contactsMgr, requestPassphrase, addToast]);

  // --- Logout ---
  const handleLogout = useCallback(() => {
    messaging.reset();
    contactsMgr.reset();
    identity.logout();
    setMode("login");
  }, [identity, contactsMgr, messaging]);

  // --- Export contact card (includes inbox cap — share with trusted contacts) ---
  const handleExportCard = useCallback(async () => {
    if (!identity.isReady) return;
    downloadJson(`dissolve-contact-${identity.id.slice(0, 12)}.json`, {
      dissolveProtocol: 4, v: 4,
      id: identity.id,
      label: identity.label,
      authPublicJwk: identity.authPubJwk,
      e2eePublicJwk: identity.e2eePubJwk,
      cap: identity.inboxCap,
      createdAt: new Date().toISOString(),
    });
  }, [identity]);

  // --- Export public profile (no inbox cap — safe to share publicly) ---
  const handleExportProfile = useCallback(async () => {
    if (!identity.isReady) return;
    const reqCapHash = await capHashFromCap(identity.requestCap);
    downloadJson(`dissolve-public-${identity.id.slice(0, 12)}.json`, {
      dissolveProtocol: 4, v: 4,
      id: identity.id,
      label: identity.label,
      authPublicJwk: identity.authPubJwk,
      e2eePublicJwk: identity.e2eePubJwk,
      requestCapHash: reqCapHash,
      createdAt: new Date().toISOString(),
    });
  }, [identity]);

  // --- Import contact card ---
  const handleImportContact = useCallback(async (file) => {
    if (!file || !identity.id) return;
    try {
      const raw = await file.text();
      const card = JSON.parse(raw);
      if (!card?.id || !card?.authPublicJwk || !card?.e2eePublicJwk) {
        addToast("Invalid contact card — missing required fields.", "error");
        return;
      }
      const computed = await identity.computeId(card.authPublicJwk);
      if (computed !== card.id) {
        addToast("Contact card failed integrity check (ID mismatch).", "error");
        return;
      }
      contactsMgr.addContact({
        id: card.id,
        label: card.label || "Contact",
        authPublicJwk: card.authPublicJwk,
        e2eePublicJwk: card.e2eePublicJwk,
        cap: typeof card.cap === "string" ? card.cap : null,
      });
      addToast(`"${card.label || card.id.slice(0, 12)}" added to contacts.`, "success");
    } catch (err) {
      addToast("Failed to import: " + err.message, "error");
    }
  }, [identity, contactsMgr, addToast]);

  // --- Accept request ---
  const handleAcceptRequest = useCallback(async (id) => {
    const req = contactsMgr.acceptRequest(id);
    if (req) {
      await messaging.sendGrant(req);
    }
  }, [contactsMgr, messaging]);

  // --- Block peer ---
  const handleBlockPeer = useCallback(async (id) => {
    const peer = contactsMgr.findPeer(id);
    if (!peer) return;
    contactsMgr.removeById(id);
    try {
      const capHash = typeof peer.cap === "string" && peer.cap
        ? await capHashFromCap(peer.cap)
        : null;
      const body = await buildBlockRequest(
        identity.id, identity.authPubJwk, identity.authPrivJwk, id, capHash
      );
      await blockOnRelay(identity.id, id, capHash, body);
    } catch { /* best-effort */ }
  }, [identity, contactsMgr]);

  // --- Directory lookup ---
  const handleLookup = useCallback(async (handle) => {
    const result = await relayLookup(handle);
    if (!result) {
      addToast("Handle not found, or relay is offline.", "error");
      return null;
    }
    return result;
  }, [addToast]);

  // --- Send contact request ---
  const handleSendRequest = useCallback(async (recipient) => {
    if (!recipient?.id || typeof recipient?.requestCap !== "string") {
      addToast("Look up a handle first.", "warning");
      return;
    }
    try {
      await messaging.sendRequest(recipient);
      addToast("Contact request sent!", "success");
    } catch (err) {
      addToast("Request failed: " + err.message, "error");
    }
  }, [messaging, addToast]);

  // --- Discoverability ---
  const handleDiscoverabilityChange = useCallback((disc, h) => {
    identity.setDiscoverable(disc);
    identity.setHandle(h);
    if (identity.id) {
      saveJson(`discoverable:${identity.id}`, { discoverable: disc, handle: h || "" });
    }
  }, [identity]);

  // --- Build contact card data for sharing (link/QR) ---
  const shareCardData = useMemo(() => {
    if (!identity.isReady) return null;
    return {
      dissolveProtocol: 4, v: 4,
      id: identity.id,
      label: identity.label,
      authPublicJwk: identity.authPubJwk,
      e2eePublicJwk: identity.e2eePubJwk,
      cap: identity.inboxCap,
      createdAt: new Date().toISOString(),
    };
  }, [identity.isReady, identity.id, identity.label, identity.authPubJwk, identity.e2eePubJwk, identity.inboxCap]);

  // --- Render ---

  // While checking for a saved session, show nothing (prevents login screen flash)
  if (!identity.sessionChecked) {
    return (
      <div className="login-screen">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div className="login-wordmark" style={{ marginBottom: "12px" }}>Dissolve</div>
          <p style={{ color: "var(--text-tertiary)", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <span className="spinner" />
            Restoring session…
          </p>
        </div>
        <ToastContainer toasts={toasts} />
      </div>
    );
  }

  if (mode === "login") {
    return (
      <>
        <LoginScreen onLogin={handleLogin} onEnroll={handleEnroll} onCheckHandle={handleCheckHandle} onRecover={handleRecover} />
        <ToastContainer toasts={toasts} />
        {passphraseState && (
          <PassphraseModal
            title={passphraseState.title}
            description={passphraseState.description}
            withConfirm={passphraseState.withConfirm}
            onConfirm={handlePassphraseConfirm}
            onCancel={handlePassphraseCancel}
          />
        )}
      </>
    );
  }

  if (mode === "mnemonic") {
    return (
      <MnemonicScreen
        mnemonic={pendingMnemonic}
        onContinue={() => {
          setPendingMnemonic(null);
          setMode("onboarding");
        }}
      />
    );
  }

  if (mode === "onboarding") {
    return <OnboardingScreen identity={identity} onContinue={() => setMode("chat")} />;
  }

  const activePeer = messaging.activeId ? contactsMgr.findPeer(messaging.activeId) : null;
  const visibleMessages = messaging.activeId
    ? messaging.messages.filter((m) => m.peerId === messaging.activeId)
    : [];

  return (
    <>
      <div className="app-layout">
        <Sidebar
          identity={identity}
          contacts={contactsMgr.contacts}
          requests={contactsMgr.requests}
          activeId={messaging.activeId}
          onSelectPeer={messaging.setActiveId}
          onExportCard={handleExportCard}
          onExportProfile={handleExportProfile}
          onImportContact={handleImportContact}
          onAcceptRequest={handleAcceptRequest}
          onRejectRequest={contactsMgr.rejectRequest}
          onBlockPeer={handleBlockPeer}
          onLookup={handleLookup}
          onSendRequest={handleSendRequest}
          onLogout={handleLogout}
          onExportKeyfile={handleExportKeyfile}
          onDiscoverabilityChange={handleDiscoverabilityChange}
          shareCardData={shareCardData}
        />
        <ChatPanel
          peer={activePeer}
          messages={visibleMessages}
          onSend={messaging.sendMsg}
        />
      </div>

      <ToastContainer toasts={toasts} />

      {passphraseState && (
        <PassphraseModal
          title={passphraseState.title}
          description={passphraseState.description}
          withConfirm={passphraseState.withConfirm}
          onConfirm={handlePassphraseConfirm}
          onCancel={handlePassphraseCancel}
        />
      )}
    </>
  );
}
