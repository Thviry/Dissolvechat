// Mobile device linking adapter
// Handles the crypto side of QR-based device linking:
// 1. Parse QR payload (sessionId + desktop public key)
// 2. Generate ephemeral ECDH keypair
// 3. Derive shared secret
// 4. POST mobile public key to relay
// 5. Poll for encrypted keyfile
// 6. Decrypt keyfile with shared secret
// 7. Return decrypted keyfile JSON

import { getRelayUrl } from './relay';

interface QrPayload {
  sessionId: string;
  desktopPublicKeyB64: string;
}

export function parseQrPayload(url: string): QrPayload | null {
  try {
    // Format: dissolve://link?sid={sessionId}&pk={base64url_publicKey}
    const parsed = new URL(url);
    if (parsed.protocol !== 'dissolve:' || parsed.hostname !== 'link') {
      // Try alternate format: dissolve://link?sid=...&pk=...
      // URL constructor may parse differently, try manual extraction
    }

    const params = parsed.searchParams || new URLSearchParams(parsed.search);
    const sid = params.get('sid');
    const pk = params.get('pk');

    if (!sid || !pk) return null;
    return { sessionId: sid, desktopPublicKeyB64: decodeURIComponent(pk) };
  } catch {
    // Try manual parsing for dissolve:// scheme
    try {
      const match = url.match(/[?&]sid=([^&]+)/);
      const pkMatch = url.match(/[?&]pk=([^&]+)/);
      if (!match || !pkMatch) return null;
      return {
        sessionId: match[1],
        desktopPublicKeyB64: decodeURIComponent(pkMatch[1]),
      };
    } catch {
      return null;
    }
  }
}

export async function performLinkFlow(
  payload: QrPayload,
  onStatus: (status: string) => void
): Promise<string> {
  const relayUrl = getRelayUrl();

  onStatus('Generating keys...');

  // Generate ephemeral ECDH keypair
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
  const mobilePubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const mobilePubB64 = btoa(JSON.stringify(mobilePubJwk));

  onStatus('Connecting to desktop...');

  // Send mobile public key to relay
  const respondResp = await fetch(`${relayUrl}/link-session/${payload.sessionId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey: mobilePubB64 }),
  });
  if (!respondResp.ok) throw new Error('Failed to respond to link session');

  onStatus('Waiting for identity transfer...');

  // Poll for encrypted keyfile (desktop encrypts and uploads)
  const maxAttempts = 60; // 2 minutes at 2s intervals
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const pollResp = await fetch(`${relayUrl}/link-session/${payload.sessionId}`);
    if (!pollResp.ok) throw new Error('Link session expired or not found');

    const data = await pollResp.json();
    if (data.hasTransfer && data.encryptedKeyfile) {
      onStatus('Decrypting identity...');

      // Parse desktop's public key
      const desktopPubJwk = JSON.parse(atob(payload.desktopPublicKeyB64));
      const desktopPubKey = await crypto.subtle.importKey(
        'jwk',
        desktopPubJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );

      // Derive shared AES key
      const sharedKey = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: desktopPubKey },
        keyPair.privateKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // Decrypt the keyfile
      const encrypted = JSON.parse(data.encryptedKeyfile);
      const iv = new Uint8Array(encrypted.iv);
      const ct = new Uint8Array(encrypted.ct);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        sharedKey,
        ct
      );

      const keyfileJson = new TextDecoder().decode(decrypted);

      // Cleanup session
      try {
        await fetch(`${relayUrl}/link-session/${payload.sessionId}`, { method: 'DELETE' });
      } catch { /* ignore */ }

      return keyfileJson;
    }
  }

  throw new Error('Timed out waiting for identity transfer');
}
