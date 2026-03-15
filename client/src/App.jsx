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
import { useIdentity } from "@hooks/useIdentity";
import { useContacts } from "@hooks/useContacts";
import { useMessaging } from "@hooks/useMessaging";
import { useToast } from "dissolve-core/hooks";
import { capHashFromCap } from "dissolve-core/crypto";
import { signObject } from "dissolve-core/crypto/signing";
import { downloadJson, saveJson } from "@utils/storage";
import { lookupDirectory as relayLookup, blockOnRelay, getRelayUrl } from "@protocol/relay";
import { buildBlockRequest, buildDirectoryPublish } from "@protocol/envelopes";
import useGroups from "@hooks/useGroups";
import useGroupActions from "@hooks/useGroupActions";
import useVoiceCall from "@hooks/useVoiceCall";
import LoginScreen from "@components/LoginScreen";
import Sidebar from "@components/Sidebar";
import ChatPanel from "@components/ChatPanel";
import CreateGroupModal from "@components/CreateGroupModal";
import GroupInfoPanel from "@components/GroupInfoPanel";
import IncomingCallOverlay from "@components/IncomingCallOverlay";
import CallBar from "@components/CallBar";
import ToastContainer from "@components/Toast";
import PassphraseModal from "@components/PassphraseModal";
import { IconClose, IconPhoneOff } from "@components/Icons";
import { idToHue } from "@utils/callHelpers";
import useMediaQuery from "@hooks/useMediaQuery";
import "./App.css";

export default function App() {
  const [mode, setMode] = useState("login"); // login | chat
  const [backupDismissed, setBackupDismissed] = useState(false);
  const [exportDismissed, setExportDismissed] = useState(false);
  const [pendingViewMnemonic, setPendingViewMnemonic] = useState(null);

  const isMobile = useMediaQuery(768);
  const [mobileView, setMobileView] = useState("contacts");

  const identity = useIdentity();
  const contactsMgr = useContacts(identity.id);
  const { toasts, addToast } = useToast();
  const groupsMgr = useGroups(identity.id);
  const messaging = useMessaging(identity, contactsMgr, groupsMgr, addToast);
  const groupActions = useGroupActions(identity, groupsMgr, addToast);
  const contactsRef = useRef(contactsMgr.contacts);
  useEffect(() => { contactsRef.current = contactsMgr.contacts; }, [contactsMgr.contacts]);
  const voiceCall = useVoiceCall(identity, contactsRef, messaging.addCallEvent);

  // Wire voice call handlers into message routing
  useEffect(() => {
    if (messaging.setVoiceCallHandlers) {
      messaging.setVoiceCallHandlers({
        handleIncomingOffer: (inner) => voiceCall.handleIncomingOffer(inner),
        handleIncomingAnswer: voiceCall.handleIncomingAnswer,
        handleIncomingIce: voiceCall.handleIncomingIce,
        handleIncomingEnd: voiceCall.handleIncomingEnd,
      });
    }
  }, [voiceCall, messaging.setVoiceCallHandlers]);

  const [activeGroupId, setActiveGroupId] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // --- Presence polling ---
  const [onlineIds, setOnlineIds] = useState({});
  useEffect(() => {
    if (!identity.isReady || contactsMgr.contacts.length === 0) return;
    const poll = async () => {
      try {
        const ids = contactsMgr.contacts.map(c => c.id).join(",");
        const resp = await fetch(`${getRelayUrl()}/presence?ids=${encodeURIComponent(ids)}`);
        if (resp.ok) {
          const data = await resp.json();
          setOnlineIds(data.online || {});
        }
      } catch { /* ignore */ }
    };
    poll();
    const timer = setInterval(poll, 20000);
    return () => clearInterval(timer);
  }, [identity.isReady, contactsMgr.contacts]);

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

  // Load groups when identity is ready
  useEffect(() => {
    if (identity.isReady && identity.id) {
      groupsMgr.load(identity.id);
    }
  }, [identity.isReady, identity.id]);

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
      await identity.exportKeyfile(passphrase, contactsMgr.contacts, groupsMgr.groups);
      localStorage.setItem(`lastExportCount:${identity.id}`, JSON.stringify({
        contacts: contactsMgr.contacts.length,
        groups: groupsMgr.groups.length,
      }));
      setExportDismissed(false);
      addToast("Key file exported successfully.", "success");
    } catch (err) {
      addToast("Export failed: " + err.message, "error");
    }
  }, [identity, contactsMgr, groupsMgr, requestPassphrase, addToast]);

  // --- Check handle availability (called from LoginScreen during enrollment) ---
  const handleCheckHandle = useCallback(async (handle) => {
    const { checkHandleAvailable } = await import("@protocol/relay");
    return checkHandleAvailable(handle);
  }, []);

  // --- Enroll ---
  const handleEnroll = useCallback(async ({ handle, displayName, passphrase }) => {
    if (!passphrase) throw new Error("Passphrase required");
    if (!handle || handle.length < 2) throw new Error("Handle required (2+ chars)");

    const stillAvailable = await handleCheckHandle(handle);
    if (!stillAvailable) throw new Error("Handle was just taken — pick another");

    try {
      await identity.enroll(displayName || handle, passphrase, handle);
      addToast("Key file saved to Downloads — keep it safe.", "info");
      setMode("chat");
    } catch (err) {
      throw new Error("Enrollment failed: " + err.message);
    }
  }, [identity, handleCheckHandle, addToast]);

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
      if (result?.importedGroups?.length > 0) {
        for (const g of result.importedGroups) {
          if (g.groupId && g.groupKey) {
            groupsMgr.addGroup(g);
          }
        }
      }
      setMode("chat");
    } catch (err) {
      addToast("Login failed: " + (err.message || "Wrong passphrase or corrupted file."), "error");
    }
  }, [identity, contactsMgr, requestPassphrase, addToast]);

  // --- Group/peer selection (mutually exclusive) ---
  const handleSelectGroup = useCallback((groupId) => {
    setActiveGroupId(groupId);
    messaging.setActiveId(groupId); // clears unread for this group
    setShowGroupInfo(false);
    if (isMobile) setMobileView("chat");
  }, [messaging, isMobile]);

  const handleSelectPeer = useCallback((peerId) => {
    messaging.setActiveId(peerId);
    setActiveGroupId(null);
    setShowGroupInfo(false);
    if (isMobile) setMobileView("chat");
  }, [messaging, isMobile]);

  // --- Logout ---
  const handleLogout = useCallback(() => {
    messaging.reset();
    contactsMgr.reset();
    groupsMgr.reset();
    identity.logout();
    setActiveGroupId(null);
    setShowCreateGroup(false);
    setShowGroupInfo(false);
    setMode("login");
    setMobileView("contacts");
  }, [identity, contactsMgr, groupsMgr, messaging]);

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
      try {
        await messaging.sendGrant(req);
      } catch (err) {
        // Grant failed — put request back so user can retry
        contactsMgr.addOrUpdateRequest(req);
        addToast("Failed to accept request. Try again.", "error");
      }
    }
  }, [contactsMgr, messaging, addToast]);

  // --- Block peer ---
  const handleBlockPeer = useCallback(async (id) => {
    const peer = contactsMgr.findPeer(id);
    if (!peer) return;
    contactsMgr.removeById(id);
    if (isMobile) setMobileView("contacts");
    try {
      const capHash = typeof peer.cap === "string" && peer.cap
        ? await capHashFromCap(peer.cap)
        : null;
      const body = await buildBlockRequest(
        identity.id, identity.authPubJwk, identity.authPrivKey, id, capHash
      );
      await blockOnRelay(identity.id, id, capHash, body);
    } catch { /* best-effort */ }
  }, [identity, contactsMgr, isMobile]);

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
  const handleDiscoverabilityChange = useCallback(async (disc, h) => {
    identity.setDiscoverable(disc);
    identity.setHandle(h);
    if (identity.id) {
      saveJson(`discoverable:${identity.id}`, { discoverable: disc, handle: h || "" });
    }
    // Republish directory entry to relay so lookup reflects the change
    const trimmed = (h || "").trim().toLowerCase();
    if (identity.isReady && trimmed) {
      try {
        const reqCapHash = identity.requestCap
          ? await capHashFromCap(identity.requestCap)
          : undefined;
        const profile = {
          dissolveProtocol: 4, v: 4,
          id: identity.id,
          label: identity.label,
          authPublicJwk: identity.authPubJwk,
          e2eePublicJwk: identity.e2eePubJwk,
          requestCap: disc ? identity.requestCap : undefined,
          requestCapHash: disc ? reqCapHash : undefined,
          discoverable: !!disc,
          showPresence: !!identity.showPresence,
        };
        const dirBody = await buildDirectoryPublish(trimmed, profile, identity.authPrivKey);
        await fetch(`${getRelayUrl()}/directory/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dirBody),
        });
      } catch { /* best-effort */ }
    }
  }, [identity]);

  // --- Presence toggle ---
  const handlePresenceChange = useCallback(async (enabled) => {
    identity.setShowPresence(enabled);
    if (identity.id) {
      saveJson(`presence:${identity.id}`, { enabled });
    }
    // Republish directory so relay knows our preference
    const trimmed = (identity.handle || "").trim().toLowerCase();
    if (identity.isReady && trimmed) {
      try {
        const reqCapHash = identity.requestCap
          ? await capHashFromCap(identity.requestCap)
          : undefined;
        const profile = {
          dissolveProtocol: 4, v: 4,
          id: identity.id,
          label: identity.label,
          authPublicJwk: identity.authPubJwk,
          e2eePublicJwk: identity.e2eePubJwk,
          requestCap: identity.discoverable ? identity.requestCap : undefined,
          requestCapHash: identity.discoverable ? reqCapHash : undefined,
          discoverable: !!identity.discoverable,
          showPresence: !!enabled,
        };
        const dirBody = await buildDirectoryPublish(trimmed, profile, identity.authPrivKey);
        await fetch(`${getRelayUrl()}/directory/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dirBody),
        });
      } catch { /* best-effort */ }
    }
  }, [identity]);

  // --- View recovery phrase (passphrase-gated) ---
  const handleViewRecoveryPhrase = useCallback(async () => {
    if (identity.mnemonic) {
      setPendingViewMnemonic(identity.mnemonic);
      localStorage.setItem(`backupCompleted:${identity.id}`, "true");
    } else {
      addToast("Recovery phrase not available in this session. Log in with your key file to access it.", "warning");
    }
  }, [identity, addToast]);

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

  const backupCompleted = identity.id
    ? JSON.parse(localStorage.getItem(`backupCompleted:${identity.id}`) || "false")
    : false;
  const showBackupBanner = identity.isReady && !backupCompleted && !backupDismissed;

  // Show export reminder when contacts/groups changed since last export
  const exportCounts = identity.id
    ? JSON.parse(localStorage.getItem(`lastExportCount:${identity.id}`) || "null")
    : null;
  const hasUnsavedData = identity.isReady && exportCounts && (
    contactsMgr.contacts.length !== exportCounts.contacts ||
    groupsMgr.groups.length !== exportCounts.groups
  );
  const showExportBanner = hasUnsavedData && !exportDismissed && !showBackupBanner;

  const activePeer = messaging.activeId ? contactsMgr.findPeer(messaging.activeId) : null;
  const visibleMessages = messaging.activeId
    ? messaging.messages.filter((m) => m.peerId === messaging.activeId)
    : [];
  const activeGroup = activeGroupId ? groupsMgr.findGroup(activeGroupId) : null;
  const activeGroupMessages = activeGroupId ? (messaging.groupMessages[activeGroupId] || []) : [];

  return (
    <>
      {showBackupBanner && (
        <div className="backup-banner" role="alert">
          <span>Back up your recovery phrase in Settings before you lose access.</span>
          <button
            className="backup-banner-dismiss"
            onClick={() => setBackupDismissed(true)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      {showExportBanner && (
        <div className="backup-banner" role="alert">
          <span>You have unsaved contacts or groups. Export your key file to keep them.</span>
          <button
            className="backup-banner-dismiss"
            onClick={() => setExportDismissed(true)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <div className="app-layout">
        {voiceCall.callState === "connected" && (
          <CallBar
            peerLabel={voiceCall.callPeer?.label}
            duration={voiceCall.callDuration}
            isMuted={voiceCall.isMuted}
            onMute={voiceCall.mute}
            onUnmute={voiceCall.unmute}
            onHangup={() => voiceCall.hangup()}
            onNavigate={() => handleSelectPeer(voiceCall.callPeer?.id)}
          />
        )}
        <Sidebar
          className={isMobile && mobileView === "chat" ? "mobile-hidden" : ""}
          identity={identity}
          contacts={contactsMgr.contacts}
          requests={contactsMgr.requests}
          activeId={messaging.activeId}
          onSelectPeer={handleSelectPeer}
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
          onPresenceChange={handlePresenceChange}
          onViewRecoveryPhrase={handleViewRecoveryPhrase}
          backupCompleted={backupCompleted}
          shareCardData={shareCardData}
          onlineIds={onlineIds}
          groups={groupsMgr.groups}
          activeGroupId={activeGroupId}
          onSelectGroup={handleSelectGroup}
          onCreateGroup={() => setShowCreateGroup(true)}
          unreadCounts={messaging.unreadCounts}
          lastMessages={messaging.lastMessages}
        />
        {activeGroup ? (
          <ChatPanel
            key={activeGroupId}
            className={isMobile && mobileView === "contacts" ? "mobile-hidden" : ""}
            isMobile={isMobile}
            onBack={() => setMobileView("contacts")}
            group={activeGroup}
            messages={activeGroupMessages}
            onSend={(_, text, file) => messaging.sendGroupMsg(activeGroupId, text, file)}
            onGroupInfo={() => setShowGroupInfo(true)}
            identityId={identity.id}
            identity={identity}
            contactCount={contactsMgr.contacts.length}
            groupCount={groupsMgr.groups.length}
          />
        ) : (
          <ChatPanel
            key={activePeer?.id}
            className={isMobile && mobileView === "contacts" ? "mobile-hidden" : ""}
            isMobile={isMobile}
            onBack={() => setMobileView("contacts")}
            peer={activePeer}
            messages={visibleMessages}
            onSend={messaging.sendMsg}
            onRetry={messaging.retryMsg}
            onDismiss={messaging.dismissMsg}
            identityId={identity.id}
            identity={identity}
            contactCount={contactsMgr.contacts.length}
            groupCount={groupsMgr.groups.length}
            onStartCall={async (peerId) => {
              const peer = contactsMgr.contacts.find(c => c.id === peerId);
              if (peer) {
                const result = await voiceCall.startCall(peer);
                if (result?.error === "turn_failed") {
                  addToast("Call failed — please try again in a moment", "error");
                }
              }
            }}
            callState={voiceCall.callState}
          />
        )}
      </div>

      {/* Voice call overlays */}
      {voiceCall.callState === "incoming" && (
        <IncomingCallOverlay
          callerLabel={voiceCall.callPeer?.label}
          callerId={voiceCall.callPeer?.id}
          onAccept={() => voiceCall.acceptCall()}
          onDecline={() => voiceCall.declineCall()}
        />
      )}

      {(voiceCall.callState === "offering" || voiceCall.callState === "ringing") && (
        <div className="call-overlay">
          <div className="call-overlay-content">
            <div className="call-overlay-avatar" style={{ "--avatar-hue": idToHue(voiceCall.callPeer?.id || "") }}>
              {(voiceCall.callPeer?.label || "?")[0].toUpperCase()}
            </div>
            <div className="call-overlay-label">{voiceCall.callPeer?.label}</div>
            <div className="call-overlay-status">Calling...</div>
            <div className="call-overlay-actions">
              <button className="call-btn call-btn-decline" onClick={() => voiceCall.hangup()} title="Cancel">
                <IconPhoneOff size={24} />
              </button>
            </div>
          </div>
        </div>
      )}

      <audio ref={voiceCall.remoteAudioRef} className="call-remote-audio" autoPlay />

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

      {showCreateGroup && (
        <CreateGroupModal
          contacts={contactsMgr.contacts}
          onClose={() => setShowCreateGroup(false)}
          onCreate={groupActions.createGroup}
        />
      )}

      {showGroupInfo && activeGroup && (
        <GroupInfoPanel
          group={activeGroup}
          myId={identity.id}
          contacts={contactsMgr.contacts}
          onClose={() => setShowGroupInfo(false)}
          onAddMember={groupActions.addGroupMember}
          onRemoveMember={groupActions.removeGroupMember}
          onChangeRole={groupActions.changeAdminRole}
          onRenameGroup={groupActions.renameGroup}
          onLeaveGroup={(gid) => { groupActions.leaveGroup(gid); setActiveGroupId(null); setShowGroupInfo(false); setMobileView("contacts"); }}
          onDeleteGroup={(gid) => { groupActions.deleteGroup(gid); setActiveGroupId(null); setShowGroupInfo(false); setMobileView("contacts"); }}
        />
      )}

      {pendingViewMnemonic && (
        <div className="modal-backdrop" onClick={() => setPendingViewMnemonic(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Recovery Phrase</h3>
              <button className="btn-icon" onClick={() => setPendingViewMnemonic(null)} aria-label="Close">
                <IconClose size={16} />
              </button>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "16px" }}>
              Write these 12 words down on paper. Do not screenshot or store in plaintext.
            </p>
            <div className="mnemonic-grid">
              {pendingViewMnemonic.trim().split(/\s+/).map((word, i) => (
                <div key={i} className="mnemonic-word">
                  <span className="mnemonic-num">{i + 1}</span>
                  <span className="mnemonic-text">{word}</span>
                </div>
              ))}
            </div>
            <div className="enroll-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => setPendingViewMnemonic(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
