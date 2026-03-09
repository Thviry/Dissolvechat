// client/src/components/LinkDeviceModal.jsx
// QR code modal for linking a mobile device.
// Flow: Generate ephemeral X25519 keypair → create session on relay → show QR →
// poll for mobile response → derive shared secret → encrypt keyfile → upload.

import { useState, useEffect, useRef } from "react";
import { IconClose } from "./Icons";
import { getRelayUrl } from "@protocol/relay";

// Lightweight QR code generation using canvas
function generateQrDataUrl(text) {
  // Use a simple QR encoding — in production, use a library like 'qrcode'
  // For now, return a placeholder that will be replaced when qrcode is installed
  return null;
}

export default function LinkDeviceModal({ identity, onClose }) {
  const [status, setStatus] = useState("generating"); // generating | waiting | transferring | success | error
  const [sessionId, setSessionId] = useState(null);
  const [qrPayload, setQrPayload] = useState("");
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const ephemeralRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Generate ephemeral ECDH keypair for key exchange
        const keyPair = await crypto.subtle.generateKey(
          { name: "ECDH", namedCurve: "P-256" },
          true,
          ["deriveKey"]
        );
        const pubJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
        ephemeralRef.current = keyPair;

        // Create unique session ID
        const sid = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const pubKeyB64 = btoa(JSON.stringify(pubJwk));

        // Register session on relay
        const relayUrl = getRelayUrl();
        const resp = await fetch(`${relayUrl}/link-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, publicKey: pubKeyB64 }),
        });
        if (!resp.ok) throw new Error("Failed to create link session");

        if (cancelled) return;

        setSessionId(sid);
        setQrPayload(`dissolve://link?sid=${sid}&pk=${encodeURIComponent(pubKeyB64)}`);
        setStatus("waiting");

        // Poll for mobile response
        pollRef.current = setInterval(async () => {
          try {
            const pollResp = await fetch(`${relayUrl}/link-session/${sid}`);
            if (!pollResp.ok) return;
            const data = await pollResp.json();

            if (data.hasResponse && !data.hasTransfer) {
              // Mobile responded — derive shared secret and encrypt keyfile
              clearInterval(pollRef.current);
              setStatus("transferring");

              const mobileKeyJwk = JSON.parse(atob(data.mobilePublicKey));
              const mobileKey = await crypto.subtle.importKey(
                "jwk",
                mobileKeyJwk,
                { name: "ECDH", namedCurve: "P-256" },
                false,
                []
              );

              // Derive AES key from ECDH shared secret
              const sharedKey = await crypto.subtle.deriveKey(
                { name: "ECDH", public: mobileKey },
                ephemeralRef.current.privateKey,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt"]
              );

              // Get keyfile content and encrypt it
              const keyfileRaw = sessionStorage.getItem("dissolve_session");
              if (!keyfileRaw) throw new Error("No session data to transfer");

              const iv = crypto.getRandomValues(new Uint8Array(12));
              const ct = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv },
                sharedKey,
                new TextEncoder().encode(keyfileRaw)
              );

              const transferPayload = JSON.stringify({
                iv: Array.from(iv),
                ct: Array.from(new Uint8Array(ct)),
              });

              // Upload encrypted keyfile
              const transferResp = await fetch(`${relayUrl}/link-session/${sid}/transfer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ encryptedKeyfile: transferPayload }),
              });
              if (!transferResp.ok) throw new Error("Failed to transfer keyfile");

              setStatus("success");

              // Cleanup session after 5s
              setTimeout(async () => {
                try {
                  await fetch(`${relayUrl}/link-session/${sid}`, { method: "DELETE" });
                } catch { /* ignore */ }
              }, 5000);
            }
          } catch (err) {
            console.warn("[LinkDevice] Poll error:", err);
          }
        }, 2000);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to start link session");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3>Link to Mobile</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ textAlign: "center", padding: "24px" }}>
          {status === "generating" && (
            <p className="text-muted">Generating secure link...</p>
          )}

          {status === "waiting" && (
            <>
              <p style={{ marginBottom: 16 }}>
                Scan this QR code with the DissolveChat mobile app.
              </p>
              <div
                style={{
                  background: "#fff",
                  padding: 16,
                  borderRadius: 4,
                  display: "inline-block",
                  marginBottom: 16,
                }}
              >
                {/* QR placeholder — install 'qrcode' package for actual QR rendering */}
                <div style={{
                  width: 200,
                  height: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "monospace",
                  fontSize: 10,
                  wordBreak: "break-all",
                  color: "#000",
                  padding: 8,
                }}>
                  {qrPayload}
                </div>
              </div>
              <p className="text-muted" style={{ fontSize: 12 }}>
                Session expires in 5 minutes.
              </p>
            </>
          )}

          {status === "transferring" && (
            <p>Transferring encrypted identity...</p>
          )}

          {status === "success" && (
            <>
              <p style={{ color: "var(--accent)" }}>Device linked successfully!</p>
              <p className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>
                Your mobile device now has your identity. Enter your passphrase on the mobile app to complete setup.
              </p>
            </>
          )}

          {status === "error" && (
            <p style={{ color: "#ff4444" }}>{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
