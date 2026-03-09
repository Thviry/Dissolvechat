// mobile/src/hooks/useIdentity.ts
// Manages the user's cryptographic identity on mobile.
// Uses iOS Keychain (SecureStore) instead of sessionStorage for session persistence.

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  sha256B64u,
  enc,
  randomCap,
  b64uFromBytes,
  jcs,
} from 'dissolve-core/crypto';
import { encryptPrivateData, decryptPrivateData } from 'dissolve-core/crypto/keyfile';
import { generateMnemonic, validateMnemonic, deriveIdentityFromMnemonic } from 'dissolve-core/crypto/seed';
import { secureStorage, appStorage } from '../adapters/storage';

// ── Non-extractable key import ───────────────────────────────────────

async function importAuthPrivKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

async function importE2eePrivKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey']
  );
}

// ── Types ────────────────────────────────────────────────────────────

interface SessionData {
  authPrivJwk: JsonWebKey;
  authPubJwk: JsonWebKey;
  e2eePrivJwk: JsonWebKey;
  e2eePubJwk: JsonWebKey;
  label: string;
  id: string;
  inboxCap: string;
  requestCap: string;
  mnemonic?: string;
}

export interface Identity {
  authPrivKey: CryptoKey;
  authPubJwk: JsonWebKey;
  e2eePrivKey: CryptoKey;
  e2eePubJwk: JsonWebKey;
  label: string;
  id: string;
  inboxCap: string;
  requestCap: string;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useIdentity() {
  const [authPrivKey, setAuthPrivKey] = useState<CryptoKey | null>(null);
  const [authPubJwk, setAuthPubJwk] = useState<JsonWebKey | null>(null);
  const [e2eePrivKey, setE2eePrivKey] = useState<CryptoKey | null>(null);
  const [e2eePubJwk, setE2eePubJwk] = useState<JsonWebKey | null>(null);
  const [label, setLabel] = useState('Me');
  const [id, setId] = useState('');
  const [inboxCap, setInboxCap] = useState<string | null>(null);
  const [requestCap, setRequestCap] = useState<string | null>(null);

  const [discoverable, setDiscoverable] = useState(false);
  const [handle, setHandle] = useState('');
  const [archiveEnabled, setArchiveEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPresence, setShowPresence] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [relayUrl, setRelayUrl] = useState('');

  const [sessionChecked, setSessionChecked] = useState(false);
  const restoredRef = useRef(false);

  const isReady = useMemo(
    () =>
      !!authPrivKey &&
      !!authPubJwk &&
      !!e2eePrivKey &&
      !!e2eePubJwk &&
      !!id &&
      typeof inboxCap === 'string' &&
      typeof requestCap === 'string',
    [authPrivKey, authPubJwk, e2eePrivKey, e2eePubJwk, id, inboxCap, requestCap]
  );

  const computeId = useCallback(async (pubJwk: JsonWebKey): Promise<string> => {
    return sha256B64u(enc.encode(jcs(pubJwk)));
  }, []);

  // Load preferences from AsyncStorage for a given identity
  const loadPreferences = useCallback(async (userId: string) => {
    const discPref = await appStorage.getJson<{ discoverable: boolean; handle: string }>(`discoverable:${userId}`);
    setDiscoverable(!!discPref?.discoverable);
    setHandle(discPref?.handle || '');

    const archPref = await appStorage.getJson<{ enabled: boolean }>(`archive:${userId}`);
    setArchiveEnabled(!!archPref?.enabled);

    const soundPref = await appStorage.getJson<{ enabled: boolean }>(`sound:${userId}`);
    setSoundEnabled(soundPref?.enabled !== false);

    const presencePref = await appStorage.getJson<{ enabled: boolean }>(`presence:${userId}`);
    setShowPresence(!!presencePref?.enabled);

    const relayPref = await appStorage.getJson<{ url: string }>(`relay:${userId}`);
    setRelayUrl(relayPref?.url || '');
  }, []);

  // Activate session state from JWK data
  const activateSession = useCallback(async (data: SessionData, skipPersist?: boolean) => {
    const [privAuthKey, privE2eeKey] = await Promise.all([
      importAuthPrivKey(data.authPrivJwk),
      importE2eePrivKey(data.e2eePrivJwk),
    ]);

    setAuthPrivKey(privAuthKey);
    setAuthPubJwk(data.authPubJwk);
    setE2eePrivKey(privE2eeKey);
    setE2eePubJwk(data.e2eePubJwk);
    setLabel(data.label || 'Me');
    setId(data.id);
    setInboxCap(data.inboxCap);
    setRequestCap(data.requestCap);
    setMnemonic(data.mnemonic || null);

    await loadPreferences(data.id);

    if (!skipPersist) {
      // Store session in iOS Keychain — survives app restarts
      await secureStorage.set('session', JSON.stringify({
        authPrivJwk: data.authPrivJwk,
        authPubJwk: data.authPubJwk,
        e2eePrivJwk: data.e2eePrivJwk,
        e2eePubJwk: data.e2eePubJwk,
        label: data.label || 'Me',
        id: data.id,
        inboxCap: data.inboxCap,
        requestCap: data.requestCap,
        mnemonic: data.mnemonic || null,
      }));
    }
  }, [loadPreferences]);

  // Restore session from Keychain on app start
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    (async () => {
      try {
        const raw = await secureStorage.get('session');
        if (raw) {
          const data: SessionData = JSON.parse(raw);
          if (data?.id && data?.authPrivJwk) {
            await activateSession(data, true);
          }
        }
      } catch { /* ignore corrupted session */ }
      setSessionChecked(true);
    })();
  }, [activateSession]);

  const enroll = useCallback(async (displayName: string, passphrase: string, enrollHandle?: string) => {
    if (!passphrase) throw new Error('Passphrase required');

    const mnemonicPhrase = generateMnemonic();
    const derived = await deriveIdentityFromMnemonic(mnemonicPhrase);
    const { authPrivJwk: authPriv, authPubJwk: authPub, e2eePrivJwk: e2eePriv, e2eePubJwk: e2eePub, inboxCap: cap, requestCap: reqCap } = derived;

    const encrypted = await encryptPrivateData(
      { authPrivateJwk: authPriv, e2eePrivateJwk: e2eePriv, inboxCap: cap, requestCap: reqCap, mnemonic: mnemonicPhrase },
      passphrase
    );
    const userId = await computeId(authPub);

    if (enrollHandle) {
      await appStorage.setJson(`discoverable:${userId}`, { discoverable: false, handle: enrollHandle.toLowerCase() });
    }

    const keyFile = {
      version: 4,
      dissolveProtocol: 4,
      id: userId,
      label: displayName || 'Me',
      handle: enrollHandle ? enrollHandle.toLowerCase() : undefined,
      auth: { alg: 'ECDSA_P-256', publicJwk: authPub },
      e2ee: { alg: 'ECDH_P-256', publicJwk: e2eePub },
      encryptedPrivate: encrypted,
      createdAt: new Date().toISOString(),
    };

    // Store keyfile for later export
    await secureStorage.set('keyfile', JSON.stringify(keyFile));

    await activateSession({
      authPrivJwk: authPriv,
      authPubJwk: authPub,
      e2eePrivJwk: e2eePriv,
      e2eePubJwk: e2eePub,
      label: displayName || 'Me',
      id: userId,
      inboxCap: cap,
      requestCap: reqCap,
      mnemonic: mnemonicPhrase,
    });

    return { keyFile, mnemonic: mnemonicPhrase };
  }, [computeId, activateSession]);

  const login = useCallback(async (fileContent: string, passphrase: string) => {
    const keyFile = JSON.parse(fileContent);
    if (!passphrase) throw new Error('Passphrase required');

    const decrypted = await decryptPrivateData(keyFile.encryptedPrivate, passphrase);
    const importedContacts = Array.isArray(decrypted.contacts) ? decrypted.contacts : [];
    const importedGroups = Array.isArray(decrypted.groups) ? decrypted.groups : [];
    const authPub = keyFile?.auth?.publicJwk;
    const e2eePub = keyFile?.e2ee?.publicJwk;
    if (!authPub || !e2eePub) throw new Error('Missing public keys in key file');

    const userId = keyFile.id || (await computeId(authPub));

    // Store keyfile for later export
    await secureStorage.set('keyfile', fileContent);

    await activateSession({
      authPrivJwk: decrypted.authPrivateJwk,
      authPubJwk: authPub,
      e2eePrivJwk: decrypted.e2eePrivateJwk,
      e2eePubJwk: e2eePub,
      label: keyFile.label || 'Me',
      id: userId,
      inboxCap: typeof decrypted.inboxCap === 'string' ? decrypted.inboxCap : randomCap(),
      requestCap: typeof decrypted.requestCap === 'string' ? decrypted.requestCap : randomCap(),
    });

    return { userId, importedContacts, importedGroups };
  }, [computeId, activateSession]);

  const recover = useCallback(async (mnemonicPhrase: string, displayName?: string) => {
    if (!validateMnemonic(mnemonicPhrase)) throw new Error('Invalid recovery phrase');
    const derived = await deriveIdentityFromMnemonic(mnemonicPhrase);
    const { authPrivJwk, authPubJwk, e2eePrivJwk, e2eePubJwk, inboxCap: cap, requestCap: reqCap } = derived;
    const userId = await computeId(authPubJwk);

    await activateSession({
      authPrivJwk,
      authPubJwk,
      e2eePrivJwk,
      e2eePubJwk,
      label: displayName || 'Me',
      id: userId,
      inboxCap: cap,
      requestCap: reqCap,
      mnemonic: mnemonicPhrase.trim(),
    });

    return { userId };
  }, [computeId, activateSession]);

  const logout = useCallback(async () => {
    await secureStorage.remove('session');
    setAuthPrivKey(null);
    setAuthPubJwk(null);
    setE2eePrivKey(null);
    setE2eePubJwk(null);
    setLabel('Me');
    setId('');
    setInboxCap(null);
    setRequestCap(null);
    setMnemonic(null);
    setDiscoverable(false);
    setHandle('');
  }, []);

  const exportKeyfile = useCallback(async (passphrase: string, contactsList?: unknown[], groupsList?: unknown[]) => {
    if (!authPubJwk || !e2eePubJwk || !id) {
      throw new Error('No active identity');
    }
    if (!passphrase) throw new Error('Passphrase required');

    // Retrieve JWKs from Keychain session
    const raw = await secureStorage.get('session');
    if (!raw) throw new Error('Session data unavailable — please log in again');
    const sessionData: SessionData = JSON.parse(raw);
    if (!sessionData?.authPrivJwk || !sessionData?.e2eePrivJwk) {
      throw new Error('Session data unavailable — please log in again');
    }

    const encrypted = await encryptPrivateData(
      {
        authPrivateJwk: sessionData.authPrivJwk,
        e2eePrivateJwk: sessionData.e2eePrivJwk,
        inboxCap,
        requestCap,
        contacts: contactsList || [],
        groups: groupsList || [],
        ...(sessionData.mnemonic ? { mnemonic: sessionData.mnemonic } : {}),
      },
      passphrase
    );

    return {
      version: 4,
      dissolveProtocol: 4,
      id,
      label,
      handle: handle || undefined,
      auth: { alg: 'ECDSA_P-256', publicJwk: authPubJwk },
      e2ee: { alg: 'ECDH_P-256', publicJwk: e2eePubJwk },
      encryptedPrivate: encrypted,
      exportedAt: new Date().toISOString(),
    };
  }, [authPubJwk, e2eePubJwk, id, label, handle, inboxCap, requestCap]);

  return {
    // State
    authPrivKey, authPrivJwk: authPrivKey, authPubJwk, e2eePrivKey, e2eePrivJwk: e2eePrivKey, e2eePubJwk,
    label, id, inboxCap, requestCap,
    discoverable, setDiscoverable,
    handle, setHandle,
    archiveEnabled, setArchiveEnabled,
    soundEnabled, setSoundEnabled,
    showPresence, setShowPresence,
    relayUrl, setRelayUrl,
    isReady,
    sessionChecked,
    // Actions
    mnemonic,
    enroll, login, recover, logout, computeId, exportKeyfile,
  };
}
