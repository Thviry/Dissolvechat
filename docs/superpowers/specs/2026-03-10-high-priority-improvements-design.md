# High Priority Improvements — Design Spec

## 1. Automated Tests (Vitest)

Add Vitest as root devDependency. Configure `vitest.config.js` with same aliases as Vite configs (`@components`, `@hooks`, `@protocol`, `@utils`, `@config`).

### Test suites:

**Crypto** (`packages/dissolve-core/src/crypto/`):
- e2ee: encrypt → decrypt roundtrip, tampered ciphertext fails, different keys fail
- group: generateGroupKey, groupEncrypt → groupDecrypt roundtrip, wrapGroupKey → unwrapGroupKey roundtrip
- keyfile: encryptPrivateData → decryptPrivateData roundtrip, wrong passphrase fails
- signing: signObject → verifyObject, tampered payload fails verification
- encoding: b64uFromBytes ↔ bytesFromB64u roundtrip, sha256B64u deterministic

**Protocol** (`client/src/protocol/`):
- Envelope builders produce valid signed JSON with required fields
- `nextSeq` increments correctly per-identity
- `deriveConvId` is deterministic and symmetric (A→B === B→A)

**Replay protection** (`client/src/utils/storage.js`):
- Duplicate msgId rejected
- Different msgId accepted
- Window cleanup works

**Rate limiter** (`server/src/ratelimit.js`):
- Requests within limit pass
- Requests exceeding limit blocked
- Different keys independent
- Window expiry resets count

## 2. CI Test Step

Add `test` job to `.github/workflows/release.yml` before the build matrix. Runs `pnpm install && pnpm test`. Build jobs use `needs: [test]`.

## 3. IP Rate Limit Fix

- `server/src/index.js`: add `app.set("trust proxy", 1)` before routes
- `server/src/ratelimit.js`: change `getIpKey` to use `req.ip` (which Express resolves correctly with trust proxy) instead of raw `x-forwarded-for` header

## 4. Group Replay Protection

In `useMessaging.js` `handleIncoming`: call `checkAndUpdateReplay` for all group envelope types (GroupMessage, GroupInvite, GroupMemberAdded, GroupMemberRemoved, GroupAdminChange, GroupLeave, GroupNameChange). Use the envelope's `msgId` as the dedup key. Skip processing if replay detected.

## 5. Replay Dedup: seq → msgId

Change `checkAndUpdateReplay` in `storage.js` to key on `msgId` instead of `${envelopeType}:${seq}`. The `msgId` is a random value generated per-message, so it never collides across devices or after recovery. Same sliding window and cleanup logic.

## 6. Unread Indicators

- Add `unreadCounts` state (`Map<peerId, number>`) in `useMessaging`
- Increment on incoming message (DM or group)
- Reset to 0 when conversation is selected (`setActiveId` / `setActiveGroupId`)
- Persist to localStorage (`unread:{identityId}`)
- Pass to `Sidebar.jsx`, render badge count on contact/group items
- CSS: `.unread-badge` — small accent-colored pill with count

## 7. Last Message Preview

- Add `lastMessages` state (`Map<peerId, {text, timestamp}>`) in `useMessaging`
- Update on send and receive (DM and group)
- Pass to `Sidebar.jsx`, render truncated text under contact/group name
- Reuse existing `.request-preview` styling pattern from requests section

## 8. sendGrant Error Handling

- Remove `.catch(() => {})` from sendGrant in `useMessaging.js`
- On failure: show toast ("Failed to accept request. Try again."), keep request in pending list
- User can retry by clicking accept again
