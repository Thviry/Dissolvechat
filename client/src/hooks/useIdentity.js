// client/src/hooks/useIdentity.js
// Manages the user's cryptographic identity: enroll, login, logout.
//
// Session persistence strategy:
// - On login/enroll, session data (private key JWKs, caps) is encrypted with a
//   random AES-256-GCM key and stored in sessionStorage.
// - The ephemeral AES key is also stored in sessionStorage.
// - sessionStorage is tab-scoped: it survives page refresh but is wiped
//   when the tab/window closes.
// - Nothing unencrypted touches any persistent storage. The relay never
//   sees private keys. localStorage is never used for key material.
//
// Non-extractable key storage:
// - Private keys are stored in React state as non-extractable CryptoKey objects.
//   This means they cannot be read back out of JS memory even by DevTools or
//   extensions — they can only be used for signing / key derivation operations.
// - The JWK form is kept ONLY in the encrypted sessionStorage blob, and is
//   accessed on demand when re-exporting the keyfile.

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  sha256B64u,
  enc,
  randomCap,
  b64uFromBytes,
  bytesFromB64u,
  jcs,
} from "dissolve-core/crypto";
import { encryptPrivateData, decryptPrivateData } from "dissolve-core/crypto/keyfile";
import { generateMnemonic, validateMnemonic, deriveIdentityFromMnemonic } from "dissolve-core/crypto/seed";
import { downloadJson, loadJson, saveJson } from "@utils/storage";

const SESSION_KEY = "dissolve_session";
const SESSION_AES = "dissolve_session_aes";
const te = new TextEncoder();
const td = new TextDecoder();

// ── Ephemeral session encryption (AES-256-GCM, random key per tab) ──

async function getOrCreateSessionAesKey() {
  const existing = sessionStorage.getItem(SESSION_AES);
  if (existing) {
    const raw = bytesFromB64u(existing);
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const exported = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  sessionStorage.setItem(SESSION_AES, b64uFromBytes(exported));
  return key;
}

async function encryptSession(data) {
  const key = await getOrCreateSessionAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = te.encode(JSON.stringify(data));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    iv: b64uFromBytes(iv),
    ct: b64uFromBytes(ciphertext),
  }));
}

async function decryptSession() {
  const blob = sessionStorage.getItem(SESSION_KEY);
  const aesRaw = sessionStorage.getItem(SESSION_AES);
  if (!blob || !aesRaw) return null;
  try {
    const { iv, ct } = JSON.parse(blob);
    const key = await crypto.subtle.importKey("raw", bytesFromB64u(aesRaw), "AES-GCM", false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytesFromB64u(iv) }, key, bytesFromB64u(ct)
    );
    return JSON.parse(td.decode(new Uint8Array(plaintext)));
  } catch {
    // Corrupted or tampered — wipe it
    clearSession();
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_AES);
}

// ── Non-extractable key import ───────────────────────────────────────

async function importAuthPrivKey(jwk) {
  return crypto.subtle.importKey(
    "jwk", jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,  // non-extractable
    ["sign"]
  );
}

async function importE2eePrivKey(jwk) {
  return crypto.subtle.importKey(
    "jwk", jwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,  // non-extractable
    ["deriveKey"]
  );
}

// ── Hook ────────────────────────────────────────────────────────────

export function useIdentity() {
  // Private keys are non-extractable CryptoKey objects — cannot be read back
  // by JS, only used for cryptographic operations.
  const [authPrivKey, setAuthPrivKey] = useState(null);
  const [authPubJwk, setAuthPubJwk] = useState(null);
  const [e2eePrivKey, setE2eePrivKey] = useState(null);
  const [e2eePubJwk, setE2eePubJwk] = useState(null);
  const [label, setLabel] = useState("Me");
  const [id, setId] = useState("");
  const [inboxCap, setInboxCap] = useState(null);
  const [requestCap, setRequestCap] = useState(null);

  const [discoverable, setDiscoverable] = useState(false);
  const [handle, setHandle] = useState("");
  const [archiveEnabled, setArchiveEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPresence, setShowPresence] = useState(false);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(false);
  const [mnemonic, setMnemonic] = useState(null);
  const [relayUrl, setRelayUrl] = useState("");

  // Track whether we've attempted session restore (to avoid flash of login screen)
  const [sessionChecked, setSessionChecked] = useState(false);
  const restoredRef = useRef(false);

  const isReady = useMemo(
    () =>
      !!authPrivKey &&
      !!authPubJwk &&
      !!e2eePrivKey &&
      !!e2eePubJwk &&
      !!id &&
      typeof inboxCap === "string" &&
      typeof requestCap === "string",
    [authPrivKey, authPubJwk, e2eePrivKey, e2eePubJwk, id, inboxCap, requestCap]
  );

  const computeId = useCallback(async (pubJwk) => {
    return sha256B64u(enc.encode(jcs(pubJwk)));
  }, []);

  // Activate session state from a data object (shared by login, enroll, restore).
  // `data` must contain the JWK form of private keys so we can import them.
  const activateSession = useCallback(async (data, skipPersist) => {
    // Import private keys as non-extractable CryptoKey objects
    const [privAuthKey, privE2eeKey] = await Promise.all([
      importAuthPrivKey(data.authPrivJwk),
      importE2eePrivKey(data.e2eePrivJwk),
    ]);

    setAuthPrivKey(privAuthKey);
    setAuthPubJwk(data.authPubJwk);
    setE2eePrivKey(privE2eeKey);
    setE2eePubJwk(data.e2eePubJwk);
    setLabel(data.label || "Me");
    setId(data.id);
    setInboxCap(data.inboxCap);
    setRequestCap(data.requestCap);
    setMnemonic(data.mnemonic || null);

    const pref = loadJson(`discoverable:${data.id}`, { discoverable: false, handle: "" });
    setDiscoverable(!!pref.discoverable);
    setHandle(pref.handle || "");
    const archPref = loadJson(`archive:${data.id}`, { enabled: false });
    setArchiveEnabled(!!archPref.enabled);
    const soundPref = loadJson(`sound:${data.id}`, { enabled: true });
    setSoundEnabled(soundPref.enabled !== false);
    const presencePref = loadJson(`presence:${data.id}`, { enabled: false });
    setShowPresence(!!presencePref.enabled);
    const rrPref = loadJson(`readReceipts:${data.id}`, { enabled: false });
    setReadReceiptsEnabled(!!rrPref.enabled);

    const relayPref = loadJson(`relay:${data.id}`, { url: "" });
    setRelayUrl(relayPref.url || "");

    // Restore theme
    const themePref = loadJson(`theme:${data.id}`, { theme: "" });
    if (themePref.theme) {
      document.documentElement.setAttribute("data-theme", themePref.theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    if (!skipPersist) {
      // Persist JWKs (encrypted) for session restore across page refreshes
      await encryptSession({
        authPrivJwk: data.authPrivJwk,
        authPubJwk: data.authPubJwk,
        e2eePrivJwk: data.e2eePrivJwk,
        e2eePubJwk: data.e2eePubJwk,
        label: data.label || "Me",
        id: data.id,
        inboxCap: data.inboxCap,
        requestCap: data.requestCap,
        // mnemonic is only present for seed-phrase-based identities
        mnemonic: data.mnemonic || null,
      });
    }
  }, []);

  // ── Restore session on mount (survives refresh, not tab close) ──
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    (async () => {
      try {
        const data = await decryptSession();
        if (data?.id && data?.authPrivJwk) {
          await activateSession(data, true); // skip re-persisting what we just read
        }
      } catch { /* ignore */ }
      setSessionChecked(true);
    })();
  }, [activateSession]);

  const enroll = useCallback(async (displayName, passphrase, handle) => {
    if (!passphrase) throw new Error("Passphrase required");

    // Generate 12-word seed phrase and derive all key material from it
    const mnemonic = generateMnemonic();
    const derived = await deriveIdentityFromMnemonic(mnemonic);
    const { authPrivJwk: authPriv, authPubJwk: authPub, e2eePrivJwk: e2eePriv, e2eePubJwk: e2eePub, inboxCap: cap, requestCap: reqCap } = derived;

    const encrypted = await encryptPrivateData(
      { authPrivateJwk: authPriv, e2eePrivateJwk: e2eePriv, inboxCap: cap, requestCap: reqCap, mnemonic },
      passphrase
    );
    const userId = await computeId(authPub);

    if (handle) {
      saveJson(`discoverable:${userId}`, { discoverable: false, handle: handle.toLowerCase() });
    }

    const keyFile = {
      version: 4,
      dissolveProtocol: 4,
      id: userId,
      label: displayName || "Me",
      handle: handle ? handle.toLowerCase() : undefined,
      auth: { alg: "ECDSA_P-256", publicJwk: authPub },
      e2ee: { alg: "ECDH_P-256", publicJwk: e2eePub },
      encryptedPrivate: encrypted,
      createdAt: new Date().toISOString(),
    };

    downloadJson(`dissolve-${userId.slice(0, 12)}.usbkey.json`, keyFile);

    await activateSession({
      authPrivJwk: authPriv,
      authPubJwk: authPub,
      e2eePrivJwk: e2eePriv,
      e2eePubJwk: e2eePub,
      label: displayName || "Me",
      id: userId,
      inboxCap: cap,
      requestCap: reqCap,
      mnemonic,
    });

    return { keyFile, mnemonic };
  }, [computeId, activateSession]);

  const login = useCallback(async (fileContent, passphrase) => {
    const keyFile = JSON.parse(fileContent);
    if (!passphrase) throw new Error("Passphrase required");

    const decrypted = await decryptPrivateData(keyFile.encryptedPrivate, passphrase);
    // Extract contacts from keyfile if present (portable contacts)
    const importedContacts = Array.isArray(decrypted.contacts) ? decrypted.contacts : [];
    const importedGroups = Array.isArray(decrypted.groups) ? decrypted.groups : [];
    const authPub = keyFile?.auth?.publicJwk;
    const e2eePub = keyFile?.e2ee?.publicJwk;
    if (!authPub || !e2eePub) throw new Error("Missing public keys in key file");

    const userId = keyFile.id || (await computeId(authPub));

    await activateSession({
      authPrivJwk: decrypted.authPrivateJwk,
      authPubJwk: authPub,
      e2eePrivJwk: decrypted.e2eePrivateJwk,
      e2eePubJwk: e2eePub,
      label: keyFile.label || "Me",
      id: userId,
      inboxCap: typeof decrypted.inboxCap === "string" ? decrypted.inboxCap : randomCap(),
      requestCap: typeof decrypted.requestCap === "string" ? decrypted.requestCap : randomCap(),
    });

    return { userId, importedContacts, importedGroups };
  }, [computeId, activateSession]);

  /**
   * Recover an identity from a 12-word seed phrase.
   * All key material and caps are re-derived deterministically.
   * displayName is optional (defaults to "Me") since it isn't stored in keys.
   */
  const recover = useCallback(async (mnemonic, displayName) => {
    if (!validateMnemonic(mnemonic)) throw new Error("Invalid recovery phrase");
    const derived = await deriveIdentityFromMnemonic(mnemonic);
    const { authPrivJwk, authPubJwk, e2eePrivJwk, e2eePubJwk, inboxCap, requestCap } = derived;
    const userId = await computeId(authPubJwk);

    await activateSession({
      authPrivJwk,
      authPubJwk,
      e2eePrivJwk,
      e2eePubJwk,
      label: displayName || "Me",
      id: userId,
      inboxCap,
      requestCap,
      mnemonic: mnemonic.trim(),
    });

    return { userId };
  }, [computeId, activateSession]);

  const logout = useCallback(() => {
    clearSession();
    setAuthPrivKey(null);
    setAuthPubJwk(null);
    setE2eePrivKey(null);
    setE2eePubJwk(null);
    setLabel("Me");
    setId("");
    setInboxCap(null);
    setRequestCap(null);
    setMnemonic(null);
    setDiscoverable(false);
    setHandle("");
  }, []);

  const exportKeyfile = useCallback(async (passphrase, contactsList, groupsList) => {
    if (!authPrivKey || !authPubJwk || !e2eePubJwk || !id) {
      throw new Error("No active identity");
    }
    if (!passphrase) throw new Error("Passphrase required");
    if (passphrase.length < 8) throw new Error("Passphrase must be at least 8 characters");

    // Private keys are non-extractable, so retrieve JWKs from the encrypted session
    const sessionData = await decryptSession();
    if (!sessionData?.authPrivJwk || !sessionData?.e2eePrivJwk) {
      throw new Error("Session data unavailable — please log in again");
    }

    const encrypted = await encryptPrivateData(
      {
        authPrivateJwk: sessionData.authPrivJwk,
        e2eePrivateJwk: sessionData.e2eePrivJwk,
        inboxCap,
        requestCap,
        contacts: contactsList || [],
        groups: groupsList || [],
        // preserve mnemonic in re-exported keyfiles
        ...(sessionData.mnemonic ? { mnemonic: sessionData.mnemonic } : {}),
      },
      passphrase
    );

    const keyFile = {
      version: 4,
      dissolveProtocol: 4,
      id,
      label,
      handle: handle || undefined,
      auth: { alg: "ECDSA_P-256", publicJwk: authPubJwk },
      e2ee: { alg: "ECDH_P-256", publicJwk: e2eePubJwk },
      encryptedPrivate: encrypted,
      exportedAt: new Date().toISOString(),
    };

    downloadJson(`dissolve-${id.slice(0, 12)}.usbkey.json`, keyFile);
    return keyFile;
  }, [authPrivKey, authPubJwk, e2eePubJwk, id, label, handle, inboxCap, requestCap]);

  return {
    // State
    authPrivKey, authPrivJwk: authPrivKey, authPubJwk, e2eePrivKey, e2eePrivJwk: e2eePrivKey, e2eePubJwk,
    label, id, inboxCap, requestCap,
    discoverable, setDiscoverable,
    handle, setHandle,
    archiveEnabled, setArchiveEnabled,
    soundEnabled, setSoundEnabled,
    showPresence, setShowPresence,
    readReceiptsEnabled, setReadReceiptsEnabled,
    relayUrl, setRelayUrl,
    isReady,
    sessionChecked,
    // Actions
    mnemonic,
    enroll, login, recover, logout, computeId, exportKeyfile,
  };
}
