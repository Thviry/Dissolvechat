# Group Chat — Design Document

**Date:** 2026-03-07
**Status:** Approved

## Overview

Add group messaging to DissolveChat while preserving the privacy-first architecture. The relay remains completely unaware of groups — all group logic lives client-side. Messages are fan-out encrypted with a shared symmetric key and delivered through each member's existing personal inbox.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Routing | Client-side fan-out | Relay has zero group awareness; membership hidden from server |
| Encryption | Shared AES-256-GCM group key | Encrypt once, send N times; efficient for groups up to 50 |
| Key distribution | Via existing 1-to-1 E2EE channels | Reuses proven infrastructure; no new key exchange needed |
| Key rotation | On member removal | Prevents removed members from reading future messages |
| Admin model | Multi-admin | Creator is admin, can promote others; admins add/remove non-admins |
| Joining | Invite-only | Admins add members directly; consistent with contact model |
| Group size | Max 50 members (v1) | Keeps fan-out practical; revisit for larger groups |
| New member history | Clean slate | Only see messages from moment of joining; privacy-respecting |
| Metadata storage | Client-side only | Group name, members, roles, keys never touch the relay |

**Future consideration:** If groups need to scale past ~100 members, revisit server-side broadcast. This would require exposing group membership to the relay — a privacy tradeoff that should be a deliberate decision.

## Architecture

### Group Identity

Each group has:
- **groupId**: Random 32-byte base64url token (NOT derived from members, since membership changes)
- **groupName**: Human-readable name, stored client-side only
- **groupKey**: AES-256 symmetric key for message encryption
- **members**: Array of `{ id, label, authPublicJwk, e2eePublicJwk, cap, role }` where role is `"admin"` or `"member"`
- **creator**: The identity ID of the group creator (immutable, always admin)
- **seq**: Monotonic sequence number per group (for replay protection)

### Group Key Lifecycle

**Creation:**
1. Creator generates random 256-bit AES key (`crypto.getRandomValues`)
2. Creator generates random groupId
3. Group metadata stored in localStorage: `group:{myId}:{groupId}`

**Distribution (adding a member):**
1. Admin builds a `GroupInvite` envelope containing:
   - groupId, groupName, groupKey (raw bytes)
   - Full member list (id, label, e2eePublicJwk, role for each)
   - Creator ID
2. Envelope sent via existing 1-to-1 E2EE channel to the new member's personal inbox
3. Simultaneously, admin sends a `GroupMemberAdded` notification to all existing members with the new member's info

**Rotation (removing a member):**
1. Admin generates new AES-256 key
2. Admin sends `GroupKeyRotation` envelope to each remaining member via 1-to-1 E2EE
3. Contains: new groupKey, removed member ID, updated member list
4. Old key discarded by all recipients
5. Messages sent with old key after rotation are unreadable by removed member

### Message Flow

**Sending a group message:**
1. Sender builds inner group envelope:
   ```
   {
     t: "GroupMessage",
     groupId: "<base64url>",
     from: "<sender_id>",
     senderLabel: "<display_name>",
     msgId: "<random>",
     text: "<plaintext>",
     seq: <number>,
     ts: <timestamp>
   }
   ```
2. Encrypt with shared groupKey (AES-256-GCM, random IV)
3. For each member (except self):
   - Wrap in standard outer envelope (e2ee-encrypted to member's e2eePub)
   - Sign with sender's authPrivKey
   - POST to `/send` with member's inbox cap
4. Add message to local state

**Receiving a group message:**
1. Standard inbox drain (existing flow — relay doesn't know it's a group message)
2. Decrypt outer envelope (existing e2ee layer)
3. Detect `t: "GroupMessage"` type
4. Look up groupId in local group store
5. Decrypt inner payload with groupKey
6. Replay check: `groupReplay[groupId][from] >= seq` → reject
7. Add to group message state

### Envelope Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `GroupInvite` | Admin → new member | Delivers group metadata + key + member list |
| `GroupMessage` | Member → all members | Encrypted group chat message |
| `GroupMemberAdded` | Admin → existing members | Notify of new member (includes their info) |
| `GroupMemberRemoved` | Admin → remaining members | Notify of removal + new rotated key |
| `GroupKeyRotation` | Admin → all members | Distribute rotated key (on member removal) |
| `GroupAdminChange` | Creator → all members | Promote/demote admin role |
| `GroupNameChange` | Admin → all members | Update group name |
| `GroupLeave` | Member → all members | Member voluntarily leaves |

### Admin Permissions

| Action | Creator | Admin | Member |
|--------|---------|-------|--------|
| Send messages | Yes | Yes | Yes |
| Add members | Yes | Yes | No |
| Remove members | Yes | Yes (non-admins only) | No |
| Promote to admin | Yes | No | No |
| Demote admin | Yes | No | No |
| Change group name | Yes | Yes | No |
| Leave group | No (must delete) | Yes | Yes |
| Delete group | Yes | No | No |

### Client-Side Storage

**localStorage per identity:**
```
groups:{myId} → [groupId1, groupId2, ...]           // group index
group:{myId}:{groupId} → {                           // group metadata
  groupId, groupName, groupKey (base64),
  members: [{ id, label, e2eePublicJwk, authPublicJwk, cap, role }],
  creator, seq, createdAt
}
groupSeq:{myId}:{groupId} → <number>                 // outgoing sequence
groupReplay:{myId}:{groupId}:{fromId} → <number>     // replay protection
```

**IndexedDB (if archive enabled):**
- Group messages stored in same encrypted archive, keyed by groupId instead of peerId

### UI Components

**Sidebar changes:**
- Groups section below contacts list
- "Create Group" button
- Group items show group name + member count
- Unread indicator per group

**Group chat view:**
- Same ChatPanel layout but messages show sender label
- Group name in header with member count
- Click header → group info panel (members, admin controls)

**Group info panel:**
- Member list with role badges (creator/admin/member)
- Add member (handle lookup or from contacts)
- Remove member (admins only, for non-admins)
- Promote/demote (creator only)
- Leave group
- Change group name (admins)

**Create group modal:**
- Group name input
- Select members from contacts
- Create button

### Replay Protection

Per-group, per-sender sequence tracking (same pattern as 1-to-1):
- `groupReplay[myId][groupId][fromId] = lastSeq`
- Reject messages with `seq <= lastSeq`
- Each sender maintains their own monotonic sequence per group

### Edge Cases

**Member removed while offline:**
- On next inbox drain, they receive `GroupMemberRemoved` with their ID
- Client removes group from local storage
- Any subsequent group messages encrypted with new key are undecryptable (fail silently, ignored)

**Admin leaves:**
- Admin role doesn't transfer automatically
- Creator should promote a replacement before leaving
- If all admins leave, group becomes read-only (no one can add/remove members)
- Members can still send messages

**Conflicting admin actions:**
- Two admins remove different members simultaneously: both removals apply, two key rotations occur
- Last key rotation wins (members accept the most recent groupKey they receive)
- Sequence numbers on GroupKeyRotation envelopes resolve ordering

**Group creator goes offline permanently:**
- Admins can still manage members
- No one can promote new admins
- Group continues to function

## Security Properties

- **Relay learns nothing:** No group IDs, names, membership, or metadata on server
- **Forward secrecy (partial):** Group key rotation on member removal ensures removed members can't read future messages. Per-message forward secrecy (like 1-to-1) is sacrificed for efficiency — acceptable tradeoff for group chat.
- **No message linkability:** Relay sees individual sends to personal inboxes; can't correlate them as belonging to the same group
- **Metadata resistance:** Group messages are indistinguishable from 1-to-1 messages at the relay level
- **Key compromise scope:** If a group key leaks, only that group's messages are affected. 1-to-1 messages and other groups are unaffected.

## Not In Scope (v1)

- Group message reactions/replies
- Media/file sharing in groups
- Read receipts for groups
- Typing indicators for groups
- Group message search
- Groups larger than 50 members
- Server-side broadcast routing
