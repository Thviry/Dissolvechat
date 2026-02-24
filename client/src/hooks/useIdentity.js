// client/src/hooks/useIdentity.js
// Manages the user's cryptographic identity: enroll, login, logout.
//
// Session persistence strategy:
// - On login/enroll, session data (private keys, caps) is encrypted with a
//   random AES-256-GCM key and stored in sessionStorage.
// - The ephemeral AES key is also stored in sessionStorage.
// - sessionStorage is tab-scoped: it survives page refresh but is wiped
//   when the tab/window closes.
// - Nothing unencrypted touches any persistent storage. The relay never
//   sees private keys. localStorage is never used for key material.

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  sha256B64u,
  enc,
  randomCap,
  b64uFromBytes,
  bytesFromB64u,
  jcs,
} from "../crypto";
import { encryptPrivateData, decryptPrivateData } from "../crypto/keyfile";
import { downloadJson, loadJson, saveJson } from "../utils/storage";

const SESSION_KEY = "dissolve_session";
const SESSION_AES = "dissolve_session_aes";
const te = new TextEncoder();
const td = new TextDecoder();

// ── Ephemeral session encryption (AES-256-GCM, random key per tab) ──

async function getOrCreateSessionAesKey() {
  const existing = sessionStorage.getItem(SESSION_AES);
  if (existing) {
    const raw = bytesFromB64u(existing);
    return crypto.subtle.importKey("raw", raw, "AES-GCM", true, ["encrypt", "decrypt"]);
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

// ── Hook ────────────────────────────────────────────────────────────

export function useIdentity() {
  const [authPrivJwk, setAuthPrivJwk] = useState(null);
  const [authPubJwk, setAuthPubJwk] = useState(null);
  const [e2eePrivJwk, setE2eePrivJwk] = useState(null);
  const [e2eePubJwk, setE2eePubJwk] = useState(null);
  const [label, setLabel] = useState("Me");
  const [id, setId] = useState("");
  const [inboxCap, setInboxCap] = useState(null);
  const [requestCap, setRequestCap] = useState(null);

  const [discoverable, setDiscoverable] = useState(false);
  const [handle, setHandle] = useState("");
  const [archiveEnabled, setArchiveEnabled] = useState(false);
  const [relayUrl, setRelayUrl] = useState("");

  // Track whether we've attempted session restore (to avoid flash of login screen)
  const [sessionChecked, setSessionChecked] = useState(false);
  const restoredRef = useRef(false);

  const isReady = useMemo(
    () =>
      !!authPrivJwk &&
      !!authPubJwk &&
      !!e2eePrivJwk &&
      !!e2eePubJwk &&
      !!id &&
      typeof inboxCap === "string" &&
      typeof requestCap === "string",
    [authPrivJwk, authPubJwk, e2eePrivJwk, e2eePubJwk, id, inboxCap, requestCap]
  );

  const computeId = useCallback(async (pubJwk) => {
    return sha256B64u(enc.encode(jcs(pubJwk)));
  }, []);

  // Activate session state from a data object (shared by login, enroll, restore)
  const activateSession = useCallback(async (data, skipPersist) => {
    setAuthPrivJwk(data.authPrivJwk);
    setAuthPubJwk(data.authPubJwk);
    setE2eePrivJwk(data.e2eePrivJwk);
    setE2eePubJwk(data.e2eePubJwk);
    setLabel(data.label || "Me");
    setId(data.id);
    setInboxCap(data.inboxCap);
    setRequestCap(data.requestCap);

    const pref = loadJson(`discoverable:${data.id}`, { discoverable: false, handle: "" });
    setDiscoverable(!!pref.discoverable);
    setHandle(pref.handle || "");
    const archPref = loadJson(`archive:${data.id}`, { enabled: false });
    setArchiveEnabled(!!archPref.enabled);

    const relayPref = loadJson(`relay:${data.id}`, { url: "" });
    setRelayUrl(relayPref.url || "");

    if (!skipPersist) {
      await encryptSession({
        authPrivJwk: data.authPrivJwk,
        authPubJwk: data.authPubJwk,
        e2eePrivJwk: data.e2eePrivJwk,
        e2eePubJwk: data.e2eePubJwk,
        label: data.label || "Me",
        id: data.id,
        inboxCap: data.inboxCap,
        requestCap: data.requestCap,
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

    const e2eePair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );
    const e2eePub = await crypto.subtle.exportKey("jwk", e2eePair.publicKey);
    const e2eePriv = await crypto.subtle.exportKey("jwk", e2eePair.privateKey);

    const signPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );
    const authPub = await crypto.subtle.exportKey("jwk", signPair.publicKey);
    const authPriv = await crypto.subtle.exportKey("jwk", signPair.privateKey);

    const cap = randomCap();
    const reqCap = randomCap();
    const encrypted = await encryptPrivateData(
      { authPrivateJwk: authPriv, e2eePrivateJwk: e2eePriv, inboxCap: cap, requestCap: reqCap },
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
    });

    return keyFile;
  }, [computeId, activateSession]);

  const login = useCallback(async (fileContent, passphrase) => {
    const keyFile = JSON.parse(fileContent);
    if (!passphrase) throw new Error("Passphrase required");

    const decrypted = await decryptPrivateData(keyFile.encryptedPrivate, passphrase);
// Extract contacts from keyfile if present (portable contacts)
    const importedContacts = Array.isArray(decrypted.contacts) ? decrypted.contacts : [];
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

    return { userId, importedContacts };
  }, [computeId, activateSession]);

  const logout = useCallback(() => {
    clearSession();
    setAuthPrivJwk(null);
    setAuthPubJwk(null);
    setE2eePrivJwk(null);
    setE2eePubJwk(null);
    setLabel("Me");
    setId("");
    setInboxCap(null);
    setRequestCap(null);
    setDiscoverable(false);
    setHandle("");
  }, []);
const exportKeyfile = useCallback(async (passphrase, contactsList) => {
    if (!authPrivJwk || !authPubJwk || !e2eePubJwk || !id) {
      throw new Error("No active identity");
    }
    if (!passphrase) throw new Error("Passphrase required");

    const encrypted = await encryptPrivateData(
      {
        authPrivateJwk: authPrivJwk,
        e2eePrivateJwk: e2eePrivJwk,
        inboxCap,
        requestCap,
        contacts: contactsList || [],
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
  }, [authPrivJwk, authPubJwk, e2eePrivJwk, e2eePubJwk, id, label, handle, inboxCap, requestCap]);
  return {
    // State
    authPrivJwk, authPubJwk, e2eePrivJwk, e2eePubJwk,
    label, id, inboxCap, requestCap,
    discoverable, setDiscoverable,
    handle, setHandle,
    archiveEnabled, setArchiveEnabled,
    relayUrl, setRelayUrl,
    isReady,
    sessionChecked,
    // Actions
    enroll, login, logout, computeId, exportKeyfile,
  };
}
