# DissolveChat iOS Mobile App — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a native iOS app for DissolveChat using Expo (React Native) that shares crypto/protocol logic with the web client, supports device linking via QR code, and receives push notifications.

**Architecture:** Expo SDK with EAS Build for cloud iOS compilation. Shared `dissolve-core` crypto package and `client/src/protocol/` imported via pnpm workspace. Platform-specific adapters for storage (Keychain, AsyncStorage, SQLite) and notifications (APNs). expo-router for file-based navigation.

**Tech Stack:** Expo SDK, React Native, TypeScript, expo-router, expo-secure-store, expo-sqlite, expo-camera, expo-notifications, expo-local-authentication, react-native-quick-crypto, EAS Build/Submit.

**Design doc:** `docs/plans/2026-03-08-mobile-app-design.md`

---

## Phase A: Project Setup + Core Integration

### Task 1: Initialize Expo project in monorepo

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/app.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/babel.config.js`
- Modify: `pnpm-workspace.yaml` (add `mobile/`)

**Step 1: Add mobile to pnpm workspace**

In `pnpm-workspace.yaml`, add `mobile` to the packages list:
```yaml
packages:
  - client
  - desktop
  - server
  - packages/*
  - mobile
```

**Step 2: Create Expo project**

```bash
cd mobile
npx create-expo-app@latest . --template blank-typescript
```

**Step 3: Configure app.json**

Set the app identity:
```json
{
  "expo": {
    "name": "DissolveChat",
    "slug": "dissolvechat",
    "version": "0.2.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "dissolve",
    "userInterfaceStyle": "dark",
    "ios": {
      "bundleIdentifier": "chat.dissolve.app",
      "supportsTablet": false,
      "infoPlist": {
        "NSCameraUsageDescription": "DissolveChat uses the camera to scan QR codes for device linking.",
        "NSFaceIDUsageDescription": "DissolveChat uses Face ID to unlock your encrypted session."
      }
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-sqlite",
      "expo-camera",
      "expo-notifications",
      "expo-local-authentication",
      "expo-document-picker",
      "expo-haptics"
    ]
  }
}
```

**Step 4: Install dependencies**

```bash
cd mobile
npx expo install expo-router expo-secure-store expo-sqlite expo-camera expo-notifications expo-local-authentication expo-document-picker expo-sharing expo-file-system expo-haptics expo-crypto @react-native-async-storage/async-storage react-native-quick-crypto
```

**Step 5: Add dissolve-core workspace dependency**

In `mobile/package.json`, add:
```json
{
  "dependencies": {
    "dissolve-core": "workspace:*"
  }
}
```

Run `pnpm install` from repo root.

**Step 6: Configure babel for crypto polyfill**

Create `mobile/babel.config.js`:
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

**Step 7: Configure path aliases in tsconfig.json**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@protocol/*": ["../client/src/protocol/*"],
      "@hooks/*": ["../client/src/hooks/*"],
      "@config": ["../client/src/config.js"]
    }
  }
}
```

**Step 8: Verify project builds**

```bash
cd mobile
npx expo start
```

Expected: Expo dev server starts, shows QR code in terminal.

**Step 9: Commit**

```bash
git add mobile/ pnpm-workspace.yaml
git commit -m "feat(mobile): initialize Expo project in monorepo"
```

---

### Task 2: Verify dissolve-core crypto on React Native

**Files:**
- Create: `mobile/src/adapters/crypto.ts`
- Create: `mobile/src/__tests__/crypto.test.ts`

**Step 1: Create crypto adapter**

`mobile/src/adapters/crypto.ts` — this module verifies that WebCrypto works via react-native-quick-crypto and re-exports dissolve-core functions:

```typescript
import 'react-native-quick-crypto';
import {
  generateKeyPair,
  e2eeEncrypt,
  e2eeDecrypt,
  sign,
  verify,
  generateGroupKey,
  groupEncrypt,
  groupDecrypt,
} from 'dissolve-core/crypto';

// Re-export — if this module imports cleanly, crypto works on RN
export {
  generateKeyPair,
  e2eeEncrypt,
  e2eeDecrypt,
  sign,
  verify,
  generateGroupKey,
  groupEncrypt,
  groupDecrypt,
};
```

**Step 2: Create smoke test**

`mobile/src/__tests__/crypto.test.ts`:
```typescript
import { generateGroupKey, groupEncrypt, groupDecrypt } from '../adapters/crypto';

describe('dissolve-core crypto on React Native', () => {
  it('round-trips group encrypt/decrypt', async () => {
    const key = await generateGroupKey();
    const plaintext = 'hello from mobile';
    const encrypted = await groupEncrypt(key, plaintext);
    const decrypted = await groupDecrypt(key, encrypted);
    expect(decrypted).toBe(plaintext);
  });
});
```

**Step 3: Run test**

```bash
cd mobile
npx jest src/__tests__/crypto.test.ts
```

Expected: PASS. If WebCrypto polyfill is needed, the import of `react-native-quick-crypto` at the top of crypto.ts handles it.

**Step 4: Commit**

```bash
git add mobile/src/
git commit -m "feat(mobile): verify dissolve-core crypto works on React Native"
```

---

### Task 3: iOS Keychain storage adapter

**Files:**
- Create: `mobile/src/adapters/storage.ts`

**Step 1: Implement storage adapter**

`mobile/src/adapters/storage.ts`:
```typescript
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Secure storage — iOS Keychain (for session keys, encrypted private data)
export const secureStorage = {
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },

  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};

// General storage — AsyncStorage (for preferences, contacts, groups)
export const appStorage = {
  async set(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  },

  async get(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  },

  async setJson(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
};
```

**Step 2: Commit**

```bash
git add mobile/src/adapters/storage.ts
git commit -m "feat(mobile): add Keychain + AsyncStorage adapters"
```

---

### Task 4: SQLite message archive adapter

**Files:**
- Create: `mobile/src/adapters/messageStore.ts`

**Step 1: Implement SQLite message store**

`mobile/src/adapters/messageStore.ts`:
```typescript
import * as SQLite from 'expo-sqlite';
import { deriveArchiveKey } from 'dissolve-core/crypto';

let db: SQLite.SQLiteDatabase | null = null;
let archiveKey: CryptoKey | null = null;

export async function openArchive(identityId: string): Promise<void> {
  db = await SQLite.openDatabaseAsync('dissolve_archive');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS messages (
      msgId TEXT PRIMARY KEY,
      convKey TEXT NOT NULL,
      ts INTEGER NOT NULL,
      iv TEXT NOT NULL,
      ct TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conv ON messages(convKey);
    CREATE INDEX IF NOT EXISTS idx_ts ON messages(ts);
  `);
  archiveKey = await deriveArchiveKey(identityId);
}

export async function saveMessage(
  msgId: string,
  convKey: string,
  ts: number,
  plaintext: string
): Promise<void> {
  if (!db || !archiveKey) return;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    archiveKey,
    encoded
  );

  await db.runAsync(
    'INSERT OR REPLACE INTO messages (msgId, convKey, ts, iv, ct) VALUES (?, ?, ?, ?, ?)',
    [
      msgId,
      convKey,
      ts,
      Buffer.from(iv).toString('base64'),
      Buffer.from(ct).toString('base64'),
    ]
  );
}

export async function loadMessages(
  convKey: string,
  limit = 50,
  before?: number
): Promise<Array<{ msgId: string; ts: number; plaintext: string }>> {
  if (!db || !archiveKey) return [];

  const rows = before
    ? await db.getAllAsync(
        'SELECT * FROM messages WHERE convKey = ? AND ts < ? ORDER BY ts DESC LIMIT ?',
        [convKey, before, limit]
      )
    : await db.getAllAsync(
        'SELECT * FROM messages WHERE convKey = ? ORDER BY ts DESC LIMIT ?',
        [convKey, limit]
      );

  const results = [];
  for (const row of rows as any[]) {
    try {
      const iv = Uint8Array.from(Buffer.from(row.iv, 'base64'));
      const ct = Uint8Array.from(Buffer.from(row.ct, 'base64')).buffer;
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        archiveKey!,
        ct
      );
      results.push({
        msgId: row.msgId,
        ts: row.ts,
        plaintext: new TextDecoder().decode(decrypted),
      });
    } catch {
      // Skip corrupted messages
    }
  }

  return results.reverse();
}

export async function clearArchive(): Promise<void> {
  if (!db) return;
  await db.execAsync('DELETE FROM messages');
}

export async function closeArchive(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  archiveKey = null;
}
```

**Step 2: Commit**

```bash
git add mobile/src/adapters/messageStore.ts
git commit -m "feat(mobile): add SQLite encrypted message archive"
```

---

## Phase B: Identity + Authentication

### Task 5: Mobile useIdentity hook

**Files:**
- Create: `mobile/src/hooks/useIdentity.ts`

This hook wraps the web client's identity logic but uses Keychain for session storage instead of sessionStorage/localStorage.

**Step 1: Implement useIdentity**

`mobile/src/hooks/useIdentity.ts`:
```typescript
import { useState, useCallback, useRef } from 'react';
import { secureStorage, appStorage } from '../adapters/storage';
import {
  generateIdentity,
  encryptPrivateData,
  decryptPrivateData,
  deriveFromMnemonic,
} from 'dissolve-core/crypto';

interface Identity {
  id: string;
  handle: string;
  label: string;
  authPublicJwk: JsonWebKey;
  e2eePublicJwk: JsonWebKey;
  authPrivJwk: CryptoKey;
  e2eePrivJwk: CryptoKey;
  inboxCap: string;
  requestCap: string;
  mnemonic?: string;
}

export function useIdentity() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from Keychain on app start
  const restoreSession = useCallback(async (): Promise<boolean> => {
    try {
      const sessionData = await secureStorage.get('session');
      if (!sessionData) {
        setLoading(false);
        return false;
      }
      const parsed = JSON.parse(sessionData);
      // Re-import CryptoKeys from stored JWK
      const authPriv = await crypto.subtle.importKey(
        'jwk', parsed.authPrivJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, ['sign']
      );
      const e2eePriv = await crypto.subtle.importKey(
        'jwk', parsed.e2eePrivJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false, ['deriveKey', 'deriveBits']
      );
      setIdentity({
        ...parsed,
        authPrivJwk: authPriv,
        e2eePrivJwk: e2eePriv,
      });
      setLoading(false);
      return true;
    } catch {
      setLoading(false);
      return false;
    }
  }, []);

  // Create new identity
  const enroll = useCallback(async (handle: string, passphrase: string) => {
    const { identity: id, mnemonic, keyfileBlob } = await generateIdentity(handle, passphrase);
    // Store session in Keychain
    await secureStorage.set('session', JSON.stringify({
      ...id,
      authPrivJwk: await crypto.subtle.exportKey('jwk', id.authPrivJwk),
      e2eePrivJwk: await crypto.subtle.exportKey('jwk', id.e2eePrivJwk),
    }));
    // Store keyfile for export
    await secureStorage.set('keyfile', JSON.stringify(keyfileBlob));
    setIdentity({ ...id, mnemonic });
    return { identity: id, mnemonic, keyfileBlob };
  }, []);

  // Login from keyfile
  const login = useCallback(async (keyfileJson: string, passphrase: string) => {
    const keyfile = JSON.parse(keyfileJson);
    const decrypted = await decryptPrivateData(keyfile, passphrase);
    await secureStorage.set('session', JSON.stringify({
      ...decrypted,
      authPrivJwk: await crypto.subtle.exportKey('jwk', decrypted.authPrivJwk),
      e2eePrivJwk: await crypto.subtle.exportKey('jwk', decrypted.e2eePrivJwk),
    }));
    await secureStorage.set('keyfile', keyfileJson);
    setIdentity(decrypted);
    return decrypted;
  }, []);

  // Recover from seed phrase
  const recover = useCallback(async (mnemonic: string, passphrase: string) => {
    const { identity: id, keyfileBlob } = await deriveFromMnemonic(mnemonic, passphrase);
    await secureStorage.set('session', JSON.stringify({
      ...id,
      authPrivJwk: await crypto.subtle.exportKey('jwk', id.authPrivJwk),
      e2eePrivJwk: await crypto.subtle.exportKey('jwk', id.e2eePrivJwk),
    }));
    await secureStorage.set('keyfile', JSON.stringify(keyfileBlob));
    setIdentity(id);
    return id;
  }, []);

  // Logout
  const logout = useCallback(async () => {
    await secureStorage.remove('session');
    setIdentity(null);
  }, []);

  return { identity, loading, restoreSession, enroll, login, recover, logout };
}
```

Note: This is a starting point. The exact `generateIdentity`, `decryptPrivateData`, and `deriveFromMnemonic` function signatures must match what dissolve-core exports. Adjust imports during implementation based on the actual dissolve-core API.

**Step 2: Commit**

```bash
git add mobile/src/hooks/useIdentity.ts
git commit -m "feat(mobile): add useIdentity hook with Keychain session storage"
```

---

### Task 6: Face ID / Touch ID integration

**Files:**
- Create: `mobile/src/adapters/biometrics.ts`

**Step 1: Implement biometric unlock**

`mobile/src/adapters/biometrics.ts`:
```typescript
import * as LocalAuthentication from 'expo-local-authentication';
import { secureStorage } from './storage';

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return compatible && enrolled;
}

export async function getBiometricType(): Promise<string | null> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Touch ID';
  }
  return null;
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock DissolveChat',
    cancelLabel: 'Use Passphrase',
    disableDeviceFallback: true,
  });
  return result.success;
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await secureStorage.get('biometric_enabled');
  return val === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await secureStorage.set('biometric_enabled', 'true');
  } else {
    await secureStorage.remove('biometric_enabled');
  }
}
```

**Step 2: Commit**

```bash
git add mobile/src/adapters/biometrics.ts
git commit -m "feat(mobile): add Face ID / Touch ID biometric adapter"
```

---

### Task 7: Welcome screen (Create / Log In / Link Device / Recover)

**Files:**
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/index.tsx`
- Create: `mobile/app/welcome.tsx`
- Create: `mobile/app/create.tsx`
- Create: `mobile/app/login.tsx`
- Create: `mobile/app/recover.tsx`
- Create: `mobile/src/theme/colors.ts`
- Create: `mobile/src/theme/fonts.ts`
- Create: `mobile/src/theme/styles.ts`

**Step 1: Create theme constants**

`mobile/src/theme/colors.ts`:
```typescript
export const themes = {
  terminal: {
    void: '#0a0a0a',
    secondary: '#161616',
    surface: '#1e1e1e',
    accent: '#39ff14',
    text: '#e0e0e0',
    textMuted: '#888888',
    border: '#2a2a2a',
  },
  ocean: {
    void: '#0a0a0a',
    secondary: '#161616',
    surface: '#1e1e1e',
    accent: '#38bdf8',
    text: '#e0e0e0',
    textMuted: '#888888',
    border: '#2a2a2a',
  },
  forest: {
    void: '#0a0a0a',
    secondary: '#161616',
    surface: '#1e1e1e',
    accent: '#4ade80',
    text: '#e0e0e0',
    textMuted: '#888888',
    border: '#2a2a2a',
  },
  ember: {
    void: '#0a0a0a',
    secondary: '#161616',
    surface: '#1e1e1e',
    accent: '#f97316',
    text: '#e0e0e0',
    textMuted: '#888888',
    border: '#2a2a2a',
  },
  violet: {
    void: '#0a0a0a',
    secondary: '#161616',
    surface: '#1e1e1e',
    accent: '#a78bfa',
    text: '#e0e0e0',
    textMuted: '#888888',
    border: '#2a2a2a',
  },
} as const;

export type ThemeName = keyof typeof themes;
export const defaultTheme: ThemeName = 'terminal';
```

`mobile/src/theme/fonts.ts`:
```typescript
// Bundled fonts — loaded in _layout.tsx via expo-font
export const fonts = {
  heading: 'IBMPlexMono-Bold',
  headingRegular: 'IBMPlexMono-Regular',
  body: 'Inter-Regular',
  bodyMedium: 'Inter-Medium',
  bodySemiBold: 'Inter-SemiBold',
  mono: 'JetBrainsMono-Regular',
} as const;
```

**Step 2: Create root layout with navigation**

`mobile/app/_layout.tsx`:
```typescript
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useEffect, useState, createContext, useContext } from 'react';
import { useIdentity } from '../src/hooks/useIdentity';
import { themes, defaultTheme, ThemeName } from '../src/theme/colors';

export const AuthContext = createContext<ReturnType<typeof useIdentity> | null>(null);
export const ThemeContext = createContext(themes[defaultTheme]);

export default function RootLayout() {
  const auth = useIdentity();
  const [theme, setTheme] = useState(themes[defaultTheme]);

  const [fontsLoaded] = useFonts({
    'IBMPlexMono-Bold': require('../assets/fonts/IBMPlexMono-Bold.ttf'),
    'IBMPlexMono-Regular': require('../assets/fonts/IBMPlexMono-Regular.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'JetBrainsMono-Regular': require('../assets/fonts/JetBrainsMono-Regular.ttf'),
  });

  useEffect(() => {
    auth.restoreSession();
  }, []);

  if (!fontsLoaded || auth.loading) return null;

  return (
    <AuthContext.Provider value={auth}>
      <ThemeContext.Provider value={theme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          {auth.identity ? (
            <Stack.Screen name="(tabs)" />
          ) : (
            <Stack.Screen name="welcome" />
          )}
        </Stack>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}
```

**Step 3: Create welcome screen**

`mobile/app/welcome.tsx`:
```typescript
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useContext } from 'react';
import { ThemeContext } from './_layout';
import { fonts } from '../src/theme/fonts';

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useContext(ThemeContext);

  return (
    <View style={[styles.container, { backgroundColor: theme.void }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.accent, fontFamily: fonts.heading }]}>
          DissolveChat
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: fonts.body }]}>
          Power to the user, not the platform.
        </Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={() => router.push('/create')}
        >
          <Text style={[styles.buttonText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
            Create Identity
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.buttonOutline, { borderColor: theme.accent }]}
          onPress={() => router.push('/login')}
        >
          <Text style={[styles.buttonText, { color: theme.accent, fontFamily: fonts.bodySemiBold }]}>
            Log In
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.buttonOutline, { borderColor: theme.border }]}
          onPress={() => router.push('/link-device')}
        >
          <Text style={[styles.buttonText, { color: theme.text, fontFamily: fonts.bodySemiBold }]}>
            Link Device
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/recover')}
        >
          <Text style={[styles.link, { color: theme.textMuted, fontFamily: fonts.body }]}>
            Recover from seed phrase
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 64 },
  title: { fontSize: 32, marginBottom: 8 },
  subtitle: { fontSize: 16 },
  buttons: { gap: 16 },
  button: { padding: 16, borderRadius: 4, alignItems: 'center' },
  buttonOutline: { padding: 16, borderRadius: 4, alignItems: 'center', borderWidth: 1 },
  buttonText: { fontSize: 16 },
  link: { fontSize: 14, textAlign: 'center', marginTop: 8 },
});
```

**Step 4: Create identity creation screen**

`mobile/app/create.tsx` — form with handle input, passphrase input (with confirm), Create button. On submit, calls `auth.enroll(handle, passphrase)`. Shows mnemonic after creation with "I've saved this" confirmation. Implementation follows the same pattern as welcome.tsx with TextInput fields and the auth context.

**Step 5: Create login screen**

`mobile/app/login.tsx` — document picker for keyfile, passphrase input. On submit, calls `auth.login(keyfileJson, passphrase)`. Restores contacts and groups from keyfile.

**Step 6: Create recover screen**

`mobile/app/recover.tsx` — 12 text inputs for seed words (or single textarea), new passphrase input. On submit, calls `auth.recover(mnemonic, passphrase)`.

**Step 7: Verify navigation flow**

```bash
cd mobile
npx expo start
```

Expected: App shows welcome screen. Tapping buttons navigates to each sub-screen.

**Step 8: Commit**

```bash
git add mobile/app/ mobile/src/theme/
git commit -m "feat(mobile): add welcome + auth screens with Terminal theme"
```

---

## Phase C: Messaging

### Task 8: Relay connection adapter

**Files:**
- Create: `mobile/src/adapters/relay.ts`

**Step 1: Create relay adapter**

This wraps `client/src/protocol/relay.js` with React Native-compatible fetch/WebSocket. Since React Native supports both `fetch()` and `WebSocket` natively, this is mostly a re-export with mobile-specific config overrides.

`mobile/src/adapters/relay.ts`:
```typescript
// React Native has native fetch and WebSocket — relay.js works as-is
// Import directly from shared protocol
export {
  setRelayUrls,
  getRelayUrls,
  publishCaps,
  publishRequestCaps,
  sendEnvelope,
  drainInbox,
  drainRequestInbox,
  connectWebSocket,
  disconnectWebSocket,
  lookupHandle,
  publishDirectory,
  checkHandleAvailable,
} from '../../client/src/protocol/relay';

// Mobile-specific config overrides
import { POLL_INTERVAL_MS, WS_RECONNECT_DELAY_MS } from '../../client/src/config';

export const MOBILE_POLL_INTERVAL_MS = 10_000;     // 10s (battery saving)
export const MOBILE_WS_RECONNECT_DELAY_MS = 5_000; // 5s (less aggressive)
```

**Step 2: Commit**

```bash
git add mobile/src/adapters/relay.ts
git commit -m "feat(mobile): add relay connection adapter with mobile config"
```

---

### Task 9: Tab navigation + Chat list screen

**Files:**
- Create: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/chats.tsx`
- Create: `mobile/app/(tabs)/contacts.tsx`
- Create: `mobile/app/(tabs)/settings.tsx`

**Step 1: Create tab layout**

`mobile/app/(tabs)/_layout.tsx`:
```typescript
import { Tabs } from 'expo-router';
import { useContext } from 'react';
import { ThemeContext } from '../_layout';
import { fonts } from '../../src/theme/fonts';

export default function TabLayout() {
  const theme = useContext(ThemeContext);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.secondary,
          borderTopColor: theme.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: {
          fontFamily: fonts.body,
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen name="chats" options={{ title: 'Chats' }} />
      <Tabs.Screen name="contacts" options={{ title: 'Contacts' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
```

**Step 2: Create chat list screen**

`mobile/app/(tabs)/chats.tsx` — FlatList of conversations sorted by last message timestamp. Each row shows contact name/handle, last message preview (truncated), timestamp, unread badge, presence dot. Tapping a row pushes to the chat screen. Pull-to-refresh triggers manual inbox drain.

**Step 3: Create placeholder contacts and settings tabs**

Simple placeholder screens that will be filled in during later tasks.

**Step 4: Commit**

```bash
git add mobile/app/\(tabs\)/
git commit -m "feat(mobile): add tab navigation with chat list screen"
```

---

### Task 10: Chat screen

**Files:**
- Create: `mobile/app/chat/[id].tsx`
- Create: `mobile/src/components/MessageBubble.tsx`
- Create: `mobile/src/components/ChatInput.tsx`

**Step 1: Create message bubble component**

`mobile/src/components/MessageBubble.tsx`:
```typescript
import { View, Text, StyleSheet } from 'react-native';
import { useContext } from 'react';
import { ThemeContext } from '../../app/_layout';
import { fonts } from '../theme/fonts';

interface Props {
  text: string;
  timestamp: number;
  isOwn: boolean;
  file?: { name: string; mimeType: string; size: number; data: string };
}

export function MessageBubble({ text, timestamp, isOwn, file }: Props) {
  const theme = useContext(ThemeContext);

  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={[
      styles.bubble,
      {
        backgroundColor: isOwn ? 'rgba(255,255,255,0.05)' : theme.surface,
        borderRightColor: isOwn ? theme.accent : 'transparent',
        borderRightWidth: isOwn ? 2 : 0,
        alignSelf: isOwn ? 'flex-end' : 'flex-start',
      },
    ]}>
      <Text style={[styles.text, { color: theme.text, fontFamily: fonts.body }]}>
        {text}
      </Text>
      <Text style={[styles.time, { color: theme.textMuted, fontFamily: fonts.mono }]}>
        {time}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 4,
    marginVertical: 2,
    marginHorizontal: 12,
  },
  text: { fontSize: 15, lineHeight: 20 },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
});
```

**Step 2: Create chat input component**

`mobile/src/components/ChatInput.tsx` — TextInput with send button and attachment button. Sends message via `sendMsg()` on submit. Attachment opens document picker / image picker. Haptic feedback on send via `expo-haptics`.

**Step 3: Create chat screen**

`mobile/app/chat/[id].tsx` — receives conversation ID from route params. FlatList (inverted) of MessageBubble components. ChatInput at bottom with KeyboardAvoidingView. Loads messages from useMessaging hook. Subscribes to WebSocket notifications for real-time updates.

**Step 4: Test message flow**

Run the relay server locally, open the web client, create two identities, send messages. Open the mobile app on Expo Go, log in with one identity, verify messages appear.

**Step 5: Commit**

```bash
git add mobile/app/chat/ mobile/src/components/
git commit -m "feat(mobile): add chat screen with message bubbles and input"
```

---

### Task 11: File sharing in chat

**Files:**
- Modify: `mobile/src/components/ChatInput.tsx` (add attachment flow)
- Create: `mobile/src/components/ImagePreview.tsx`

**Step 1: Add attachment button to ChatInput**

Use `expo-document-picker` for files and `expo-image-picker` for camera roll. Files under 5MB are base64-encoded and sent inline via the existing `sendMsg` file parameter.

**Step 2: Add image preview in message bubbles**

`mobile/src/components/ImagePreview.tsx` — if message has a file with image MIME type, render an `<Image>` component with base64 data URI. Tap opens full-screen modal.

**Step 3: Commit**

```bash
git add mobile/src/components/
git commit -m "feat(mobile): add file sharing and image preview in chat"
```

---

## Phase D: Contacts + Groups

### Task 12: Contacts screen

**Files:**
- Modify: `mobile/app/(tabs)/contacts.tsx`
- Create: `mobile/app/add-contact.tsx`
- Create: `mobile/src/components/ContactRow.tsx`

**Step 1: Implement contacts list**

FlatList with two sections: "Contacts" and "Requests" (incoming + outgoing). Each row shows handle, presence dot (if online), accept/decline buttons for requests.

**Step 2: Implement add contact modal**

`mobile/app/add-contact.tsx` — TextInput for handle search, calls `lookupHandle()`. Results show handle + "Send Request" button.

**Step 3: Commit**

```bash
git add mobile/app/ mobile/src/components/
git commit -m "feat(mobile): add contacts screen with handle search"
```

---

### Task 13: Group chat

**Files:**
- Create: `mobile/app/create-group.tsx`
- Create: `mobile/app/group-info/[id].tsx`
- Modify: `mobile/app/(tabs)/chats.tsx` (show groups in list)
- Modify: `mobile/app/chat/[id].tsx` (handle group messages)

**Step 1: Create group modal**

`mobile/app/create-group.tsx` — group name input, multi-select from contacts list, Create button. Calls `createGroup()` from useGroups hook.

**Step 2: Group info screen**

`mobile/app/group-info/[id].tsx` — shows group name, member list, admin controls (add/remove member, change admin). Only visible to admins.

**Step 3: Extend chat screen for groups**

Chat screen already receives a conversation ID. Extend to detect group conversations and use `groupMessages` state + `sendGroupMsg()` instead of 1-to-1 variants.

**Step 4: Extend chat list**

Show both 1-to-1 and group conversations in the same FlatList, sorted by last message. Group rows show group name + member count.

**Step 5: Commit**

```bash
git add mobile/app/ mobile/src/
git commit -m "feat(mobile): add group chat creation, info, and messaging"
```

---

## Phase E: Device Linking

### Task 14: Relay link-session endpoints

**Files:**
- Modify: `server/src/index.js` (or create `server/src/routes/linkSession.js`)
- Modify: `server/src/store.js` (add linkSessions map)

**Step 1: Add link session store**

In `server/src/store.js`, add:
```javascript
const linkSessions = new Map(); // sessionId → { publicKey, mobilePublicKey?, encryptedKeyfile?, createdAt }
```

Auto-expire entries after 5 minutes via setInterval cleanup.

**Step 2: Add link session routes**

```javascript
// POST /link-session — desktop creates session
router.post('/link-session', (req, res) => {
  const { sessionId, publicKey } = req.body;
  if (!sessionId || !publicKey) return res.status(400).json({ error: 'missing fields' });
  if (linkSessions.has(sessionId)) return res.status(409).json({ error: 'session exists' });
  linkSessions.set(sessionId, { publicKey, createdAt: Date.now() });
  res.json({ ok: true });
});

// GET /link-session/:sid — poll session state
router.get('/link-session/:sid', (req, res) => {
  const session = linkSessions.get(req.params.sid);
  if (!session) return res.status(404).json({ error: 'not found' });
  res.json({
    hasResponse: !!session.mobilePublicKey,
    hasTransfer: !!session.encryptedKeyfile,
    mobilePublicKey: session.mobilePublicKey || null,
    encryptedKeyfile: session.encryptedKeyfile || null,
  });
});

// POST /link-session/:sid/respond — mobile sends its public key
router.post('/link-session/:sid/respond', (req, res) => {
  const session = linkSessions.get(req.params.sid);
  if (!session) return res.status(404).json({ error: 'not found' });
  session.mobilePublicKey = req.body.publicKey;
  res.json({ ok: true });
});

// POST /link-session/:sid/transfer — desktop uploads encrypted keyfile
router.post('/link-session/:sid/transfer', (req, res) => {
  const session = linkSessions.get(req.params.sid);
  if (!session) return res.status(404).json({ error: 'not found' });
  session.encryptedKeyfile = req.body.encryptedKeyfile;
  res.json({ ok: true });
});

// DELETE /link-session/:sid — cleanup
router.delete('/link-session/:sid', (req, res) => {
  linkSessions.delete(req.params.sid);
  res.json({ ok: true });
});
```

Rate limit: max 10 active link sessions globally, max 3 per IP.

**Step 3: Commit**

```bash
git add server/src/
git commit -m "feat(server): add link-session endpoints for device linking"
```

---

### Task 15: Desktop "Link to Mobile" UI

**Files:**
- Modify: `client/src/components/Sidebar.jsx` (add Link to Mobile button in settings)
- Create: `client/src/components/LinkDeviceModal.jsx`

**Step 1: Create LinkDeviceModal**

Generates ephemeral X25519 keypair, creates session on relay, renders QR code (use a lightweight QR library like `qrcode` npm package). Polls relay for mobile's response. On response, derives shared secret, encrypts keyfile, uploads. Shows success/failure state.

QR payload: `dissolve://link?sid={sessionId}&pk={base64url_publicKey}`

**Step 2: Add button to settings section in Sidebar**

Add "Link to Mobile" button that opens the modal.

**Step 3: Test end-to-end**

Desktop shows QR → mobile (next task) scans → keyfile transfers.

**Step 4: Commit**

```bash
git add client/src/components/
git commit -m "feat(client): add Link to Mobile QR code modal"
```

---

### Task 16: Mobile QR scanner + link flow

**Files:**
- Create: `mobile/app/link-device.tsx`
- Create: `mobile/src/adapters/linking.ts`

**Step 1: Create linking adapter**

`mobile/src/adapters/linking.ts` — handles the crypto side of device linking:
- Parse QR payload (extract sessionId + desktop public key)
- Generate ephemeral X25519 keypair
- Derive shared secret via X25519 DH
- POST mobile public key to relay
- Poll for encrypted keyfile
- Decrypt keyfile with shared secret
- Return decrypted keyfile JSON

**Step 2: Create link device screen**

`mobile/app/link-device.tsx` — opens camera with `expo-camera` barcode scanner. On scan, parses dissolve:// URL, runs linking flow, prompts for passphrase, activates session.

**Step 3: Test full flow**

1. Desktop: Settings > Link to Mobile → QR appears
2. Mobile: Welcome > Link Device → camera opens → scan QR
3. Mobile: prompted for passphrase → enters it → logged in with full contacts + groups

**Step 4: Commit**

```bash
git add mobile/app/link-device.tsx mobile/src/adapters/linking.ts
git commit -m "feat(mobile): add QR scanner and device linking flow"
```

---

## Phase F: Push Notifications

### Task 17: APNs integration on relay

**Files:**
- Modify: `server/src/store.js` (add pushTokens map)
- Modify: `server/src/index.js` (add push token routes + APNs client)
- Create: `server/src/push.js` (APNs sender)

**Step 1: Create APNs sender module**

`server/src/push.js`:
```javascript
import http2 from 'node:http2';

let apnsClient = null;
const APNS_HOST = process.env.APNS_HOST || 'https://api.push.apple.com';
const APNS_KEY_ID = process.env.APNS_KEY_ID;
const APNS_TEAM_ID = process.env.APNS_TEAM_ID;
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'chat.dissolve.app';

// JWT token generation for APNs auth
function generateApnsJwt() {
  // Use the .p8 key file to sign a JWT
  // Implementation uses node:crypto to sign ES256 JWT
  // Token cached for 50 minutes (APNs allows 60 min)
}

export async function sendSilentPush(deviceToken) {
  if (!APNS_KEY_ID || !APNS_TEAM_ID) return; // APNs not configured

  const payload = JSON.stringify({
    aps: { 'content-available': 1 },
  });

  // Send via HTTP/2 to APNs
  // POST /3/device/{deviceToken}
  // Headers: authorization: bearer {jwt}, apns-topic: {bundleId}, apns-push-type: background, apns-priority: 5
}
```

**Step 2: Add push token routes**

```javascript
// POST /push-token — register device token (signed request)
// DELETE /push-token — deregister on logout
```

**Step 3: Trigger push on message delivery**

In the send route, after queuing an envelope for a recipient with no active WebSocket, call `sendSilentPush(deviceToken)`.

**Step 4: Commit**

```bash
git add server/src/
git commit -m "feat(server): add APNs silent push notification support"
```

---

### Task 18: Mobile push notification handling

**Files:**
- Create: `mobile/src/adapters/notifications.ts`
- Modify: `mobile/app/_layout.tsx` (register for push on auth)

**Step 1: Create notification adapter**

`mobile/src/adapters/notifications.ts`:
```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export async function registerForPush(): Promise<string | null> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const token = await Notifications.getDevicePushTokenAsync();
  return token.data;
}

export async function showLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // immediate
  });
}

export function onBackgroundNotification(
  callback: () => Promise<void>
) {
  // When silent push arrives, drain inbox and show local notification
  Notifications.addNotificationResponseReceivedListener(callback);
}
```

**Step 2: Register push token on login**

In `_layout.tsx`, after successful auth, call `registerForPush()` and POST the token to `POST /push-token` on the relay.

**Step 3: Handle background fetch**

When silent push wakes the app, connect to relay, drain inbox, generate local notification with "New message" text (no content preview).

**Step 4: Commit**

```bash
git add mobile/src/adapters/notifications.ts mobile/app/_layout.tsx
git commit -m "feat(mobile): add push notification registration and handling"
```

---

## Phase G: Polish + App Store

### Task 19: Settings screen

**Files:**
- Modify: `mobile/app/(tabs)/settings.tsx`

**Step 1: Implement full settings screen**

ScrollView with sections:
- **Identity**: Handle, identity ID (truncated, tap to copy)
- **Security**: View recovery phrase, export keyfile (via `expo-sharing`), Face ID toggle
- **Preferences**: Theme picker (5 themes), notifications toggle, presence toggle, discoverability toggle
- **Local Storage**: Archive toggle (enable/disable SQLite archive)
- **Device**: Link to Mobile (shows note that this is done from desktop)
- **Account**: Log out button

**Step 2: Commit**

```bash
git add mobile/app/\(tabs\)/settings.tsx
git commit -m "feat(mobile): add full settings screen"
```

---

### Task 20: Theme system

**Files:**
- Create: `mobile/src/theme/ThemeProvider.tsx`
- Modify: `mobile/app/_layout.tsx` (use ThemeProvider)

**Step 1: Create theme provider**

Wraps the app in a context that reads theme preference from AsyncStorage and provides current theme colors to all components. Theme changes are persisted and applied immediately.

**Step 2: Verify all 5 themes render correctly**

Switch between Terminal, Ocean, Forest, Ember, Violet — verify accent colors update throughout the app.

**Step 3: Commit**

```bash
git add mobile/src/theme/ mobile/app/_layout.tsx
git commit -m "feat(mobile): add theme system with 5 themes"
```

---

### Task 21: Deep linking

**Files:**
- Modify: `mobile/app.json` (scheme already set to "dissolve")
- Create: `mobile/app/link/[...params].tsx`

**Step 1: Handle dissolve:// URLs**

- `dissolve://link?sid={}&pk={}` → route to link-device flow
- `dissolve://contact?data={}` → parse contact data, show add-contact confirmation

**Step 2: Configure Universal Links**

Add `associatedDomains` to app.json for `dissolve.chat` domain. Create `.well-known/apple-app-site-association` on the landing page server.

**Step 3: Commit**

```bash
git add mobile/ landing/
git commit -m "feat(mobile): add deep linking for device linking and contact import"
```

---

### Task 22: App assets + EAS Build configuration

**Files:**
- Create: `mobile/assets/icon.png` (1024x1024 app icon)
- Create: `mobile/assets/splash.png` (splash screen)
- Create: `mobile/eas.json`

**Step 1: Create EAS build config**

`mobile/eas.json`:
```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "ios": {
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "APPLE_ID_HERE",
        "ascAppId": "ASC_APP_ID_HERE",
        "appleTeamId": "TEAM_ID_HERE"
      }
    }
  }
}
```

**Step 2: Create app icon and splash**

Design app icon — black background, acid green DissolveChat logo/mark. Splash screen — black background with centered logo.

**Step 3: Build development client**

```bash
cd mobile
eas build --profile development --platform ios
```

This builds on EAS cloud Macs. Once complete, install the development build on your iPhone via QR code. Then use `npx expo start --dev-client` for hot-reload development.

**Step 4: Commit**

```bash
git add mobile/eas.json mobile/assets/
git commit -m "chore(mobile): add EAS build config and app assets"
```

---

### Task 23: TestFlight + App Store submission

**Step 1: Build production binary**

```bash
cd mobile
eas build --profile production --platform ios
```

**Step 2: Submit to TestFlight**

```bash
eas submit --platform ios
```

**Step 3: App Store listing**

Prepare in App Store Connect:
- Screenshots (iPhone 15 Pro, iPhone SE)
- Description: "End-to-end encrypted chat. No accounts. No phone number. Your identity is a keypair."
- Keywords: encrypted, chat, privacy, e2ee, secure messenger
- Category: Social Networking
- Export compliance: Yes, uses encryption (AES-256-GCM, ECDH, ECDSA) — select "exempt" if qualifies under mass-market exemption, otherwise file ERN

**Step 4: TestFlight beta**

Invite testers via TestFlight link. Collect feedback via GitHub Issues (templates already set up).

---

## Summary

| Phase | Tasks | What's delivered |
|-------|-------|------------------|
| A: Setup | 1-4 | Expo project, crypto verified, Keychain + SQLite adapters |
| B: Identity | 5-7 | Create/login/recover flows, Face ID, welcome screens |
| C: Messaging | 8-11 | Relay connection, chat list, chat screen, file sharing |
| D: Contacts + Groups | 12-13 | Contact list, handle search, group creation + management |
| E: Device Linking | 14-16 | Relay endpoints, desktop QR modal, mobile scanner |
| F: Push | 17-18 | APNs on relay, silent push, local notifications |
| G: Polish | 19-23 | Settings, themes, deep links, EAS build, App Store |

**Total: 23 tasks across 7 phases.**

Phases A-D can begin immediately (no Apple dev account needed — test on Expo Go).
Phase E requires the web client changes + relay updates.
Phase F requires the Apple dev account (APNs needs an App ID).
Phase G requires the Apple dev account for EAS Build + TestFlight.
