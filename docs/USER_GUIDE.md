# DissolveChat User Guide

This guide covers everything you need to use DissolveChat — from creating your identity to backing up your data.

---

## Getting Started

### Download

Get the desktop app for Windows, macOS, or Linux at [dissolve.chat](https://dissolve.chat). You can also use the web client directly in your browser.

### Create Your Identity

1. Open DissolveChat and choose **Create New Identity**.
2. Pick a **handle** — this is how others find and message you.
3. Set a **passphrase** — this encrypts your keyfile. Use something strong.
4. Your encrypted keyfile (`.usbkey.json`) downloads automatically. **Save this file somewhere safe.** It is your identity.

There are no accounts, no email addresses, no phone numbers. Your identity is the keypair inside that keyfile. If you lose it and your recovery phrase, your identity is gone.

### Recovery Phrase

After creating your identity, go to **Settings > Security > View Recovery Phrase**. You will see 12 words. Write them down on paper and store them somewhere secure. This phrase can regenerate your keypair if you lose your keyfile.

A banner will appear in the chat view reminding you to do this until you view your recovery phrase.

---

## Adding Contacts

### Find Someone by Handle

1. Click the **Add Contact** button in the sidebar.
2. Type their handle and search.
3. If they have **discoverability** enabled, they will appear in results.
4. Send them a contact request.

If they don't have discoverability enabled, you will need them to share their handle with you directly, or they can send you a request instead.

### Contact Requests

- **Incoming requests** appear in your sidebar. You can accept or decline them.
- **Outgoing requests** are visible until the other person responds.
- Once both sides accept, you can message each other.

---

## Messaging

### Sending Messages

Select a contact in the sidebar and type your message. Press Enter or click the send button. Messages are encrypted on your device before they leave — the relay server never sees the content.

### File Sharing

Click the attachment button to send a file (up to 5MB). Images show an inline preview in the chat. Other file types appear as downloadable links.

### Message Persistence

By default, messages are **ephemeral** — they disappear when you close the tab or app. This is by design.

If you want to keep message history, go to **Settings** and enable **Save messages locally**. This stores messages in an encrypted database (AES-256-GCM) on your device. The relay server still stores nothing.

Disabling local storage wipes the archive immediately.

---

## Group Chat

### Creating a Group

1. Click the **Create Group** button in the sidebar.
2. Name your group and select members from your contacts.
3. You become the group admin.

Groups support up to 50 members.

### Managing Members

As admin, you can:
- **Add members** from your contacts
- **Remove members** from the group
- **Promote or demote admins**

### How Group Encryption Works

Groups use a shared encryption key. Every message is encrypted with that key, then individually wrapped for each member using their personal encryption key. The relay has zero awareness that group messages exist — it just sees normal encrypted blobs between individuals.

All group members can read all group messages. Keep this in mind when adding people.

---

## Backup and Recovery

### Export Your Keyfile

Go to **Settings > Export Key File**. Enter your passphrase to download an updated keyfile. This file contains your identity, all your contacts, and all your groups.

**Re-export after adding new contacts or groups.** The keyfile is a snapshot — it only contains what existed when you exported it.

### Restore from Keyfile

1. Open DissolveChat and choose **Log In**.
2. Select your `.usbkey.json` file.
3. Enter your passphrase.
4. Your contacts and groups are restored automatically.

### Restore from Recovery Phrase

If you lost your keyfile but have your 12-word recovery phrase:

1. Open DissolveChat and choose **Recover**.
2. Enter your 12 words.
3. Set a new passphrase.
4. Your keypair is regenerated and a new keyfile downloads.

Note: Recovery from seed phrase restores your identity (keypair) but **not** your contacts or groups. Those are only stored in the keyfile. This is why re-exporting your keyfile after changes is important.

### What Happens If You Lose Everything

If you lose both your keyfile and your recovery phrase, your identity is **permanently gone**. There is no server-side account, no "forgot password" flow, no support team that can help. This is the trade-off of self-sovereign identity.

---

## Settings

### Themes

Choose from five themes: **Terminal** (default, acid green), **Ocean**, **Forest**, **Ember**, or **Violet**.

### Discoverability

When enabled, other users can find you by searching your handle. When disabled, you are invisible to searches — people can only contact you if they already know your handle.

### Online Presence

Opt-in, off by default. When enabled, your contacts see a green dot when you are online. When disabled, you appear offline to everyone.

### Message Notifications

Toggle audio notifications (a two-tone ping) and title bar flashing when you receive a message. On by default.

### Local Message Archive

When enabled, messages are stored in an encrypted database on your device and persist across sessions. When disabled, messages vanish when you close the app. Disabling this setting **immediately deletes** all stored messages.

---

## Security Model

**Your messages are encrypted on your device** before they are sent. The relay server receives only encrypted blobs that it cannot read.

**The relay is in-memory only.** Nothing is written to disk on the server. Messages, capabilities, and queues are all lost when the server restarts.

**Your identity is a keypair, not an account.** There is no registration database, no email, no phone number. You are your keys.

**Message sizes are padded** to fixed buckets (512B, 1KB, 2KB, 4KB) so that an observer cannot guess message content length from ciphertext size.

**Group messages are doubly encrypted.** First with the shared group key, then individually for each recipient. The relay cannot tell the difference between a group message and a direct message.

**There is no backdoor.** No one — not the relay operator, not the developers — can read your messages or recover your identity. This is a feature, not a limitation.
