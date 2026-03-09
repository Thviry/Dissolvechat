import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useContext, useState, useEffect, useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { AuthContext, ThemeContext, SetThemeContext } from '../_layout';
import { fonts } from '../../src/theme/fonts';
import { themes, ThemeName } from '../../src/theme/colors';
import { appStorage } from '../../src/adapters/storage';
import {
  isBiometricAvailable,
  getBiometricType,
  isBiometricEnabled,
  setBiometricEnabled,
  authenticateWithBiometrics,
} from '../../src/adapters/biometrics';

const themeNames: { key: ThemeName; label: string }[] = [
  { key: 'terminal', label: 'Terminal' },
  { key: 'ocean', label: 'Ocean' },
  { key: 'forest', label: 'Forest' },
  { key: 'ember', label: 'Ember' },
  { key: 'violet', label: 'Violet' },
];

export default function SettingsScreen() {
  const auth = useContext(AuthContext)!;
  const theme = useContext(ThemeContext);
  const setTheme = useContext(SetThemeContext);

  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [biometricOn, setBiometricOn] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Detect current theme name from accent color
  const currentTheme = (Object.entries(themes) as [ThemeName, typeof theme][]).find(
    ([, t]) => t.accent === theme.accent
  )?.[0] ?? 'terminal';

  useEffect(() => {
    (async () => {
      const available = await isBiometricAvailable();
      if (available) {
        const type = await getBiometricType();
        setBiometricType(type);
        const enabled = await isBiometricEnabled();
        setBiometricOn(enabled);
      }
    })();
  }, []);

  const handleBiometricToggle = useCallback(async (value: boolean) => {
    if (value) {
      const success = await authenticateWithBiometrics();
      if (!success) return;
    }
    setBiometricOn(value);
    await setBiometricEnabled(value);
  }, []);

  const handleCopyId = useCallback(async () => {
    if (!auth.id) return;
    await Clipboard.setStringAsync(auth.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }, [auth.id]);

  const handleExportKeyfile = useCallback(async () => {
    Alert.prompt(
      'Export Keyfile',
      'Enter your passphrase to encrypt the keyfile:',
      async (passphrase) => {
        if (!passphrase) return;
        try {
          const contacts = await appStorage.getJson<any[]>(`contacts:${auth.id}`) || [];
          const groups = await appStorage.getJson<any[]>(`groups:${auth.id}`) || [];
          const keyfile = await auth.exportKeyfile(passphrase, contacts, groups);
          const json = JSON.stringify(keyfile, null, 2);
          const path = `${FileSystem.cacheDirectory}dissolve-keyfile.json`;
          await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
          await Sharing.shareAsync(path, {
            mimeType: 'application/json',
            dialogTitle: 'Export Keyfile',
            UTI: 'public.json',
          });
        } catch (err: any) {
          Alert.alert('Export Failed', err.message || 'Could not export keyfile.');
        }
      },
      'secure-text'
    );
  }, [auth]);

  const handleDiscoverabilityToggle = useCallback(async (value: boolean) => {
    auth.setDiscoverable(value);
    await appStorage.setJson(`discoverable:${auth.id}`, {
      discoverable: value,
      handle: auth.handle,
    });
    // TODO: republish directory entry to relay
  }, [auth]);

  const handlePresenceToggle = useCallback(async (value: boolean) => {
    auth.setShowPresence(value);
    await appStorage.setJson(`presence:${auth.id}`, { enabled: value });
    // TODO: republish directory entry to relay
  }, [auth]);

  const handleSoundToggle = useCallback(async (value: boolean) => {
    auth.setSoundEnabled(value);
    await appStorage.setJson(`sound:${auth.id}`, { enabled: value });
  }, [auth]);

  const handleArchiveToggle = useCallback(async (value: boolean) => {
    if (!value) {
      Alert.alert(
        'Disable Archive',
        'This will delete all locally stored messages. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              auth.setArchiveEnabled(false);
              await appStorage.setJson(`archive:${auth.id}`, { enabled: false });
              // TODO: clear SQLite archive
            },
          },
        ]
      );
    } else {
      auth.setArchiveEnabled(true);
      await appStorage.setJson(`archive:${auth.id}`, { enabled: true });
    }
  }, [auth]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Log Out',
      'Make sure you have exported your keyfile. You will need it to log back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => auth.logout(),
        },
      ]
    );
  }, [auth]);

  return (
    <View style={[styles.container, { backgroundColor: theme.void }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text, fontFamily: fonts.heading }]}>
          Settings
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Identity */}
        <Text style={[styles.sectionTitle, { color: theme.accent, fontFamily: fonts.heading }]}>
          Identity
        </Text>
        <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          {auth.handle ? (
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.textMuted, fontFamily: fonts.body }]}>Handle</Text>
              <Text style={[styles.rowValue, { color: theme.text, fontFamily: fonts.mono }]}>
                @{auth.handle}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.row} onPress={handleCopyId}>
            <Text style={[styles.rowLabel, { color: theme.textMuted, fontFamily: fonts.body }]}>Identity ID</Text>
            <Text style={[styles.rowValue, { color: theme.text, fontFamily: fonts.mono }]} numberOfLines={1}>
              {copiedId ? 'Copied!' : auth.id ? `${auth.id.slice(0, 16)}...` : '—'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Security */}
        <Text style={[styles.sectionTitle, { color: theme.accent, fontFamily: fonts.heading }]}>
          Security
        </Text>
        <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => setShowMnemonic(!showMnemonic)}
          >
            <Text style={[styles.rowLabel, { color: theme.textMuted, fontFamily: fonts.body }]}>
              Recovery Phrase
            </Text>
            <Text style={[styles.rowAction, { color: theme.accent, fontFamily: fonts.bodySemiBold }]}>
              {showMnemonic ? 'Hide' : 'View'}
            </Text>
          </TouchableOpacity>
          {showMnemonic && auth.mnemonic ? (
            <View style={[styles.mnemonicBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.mnemonicText, { color: theme.text, fontFamily: fonts.mono }]}>
                {auth.mnemonic}
              </Text>
              <Text style={[styles.mnemonicWarn, { color: theme.accent, fontFamily: fonts.body }]}>
                Write this down and keep it safe. Anyone with this phrase can access your account.
              </Text>
            </View>
          ) : showMnemonic && !auth.mnemonic ? (
            <View style={[styles.mnemonicBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.mnemonicText, { color: theme.textMuted, fontFamily: fonts.body }]}>
                Recovery phrase unavailable. You may have logged in with a keyfile.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.row} onPress={handleExportKeyfile}>
            <Text style={[styles.rowLabel, { color: theme.textMuted, fontFamily: fonts.body }]}>
              Export Keyfile
            </Text>
            <Text style={[styles.rowAction, { color: theme.accent, fontFamily: fonts.bodySemiBold }]}>
              Export
            </Text>
          </TouchableOpacity>

          {biometricType ? (
            <View style={styles.switchRow}>
              <Text style={[styles.rowLabel, { color: theme.textMuted, fontFamily: fonts.body }]}>
                {biometricType}
              </Text>
              <Switch
                value={biometricOn}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: theme.surface, true: theme.accent }}
                thumbColor="#fff"
              />
            </View>
          ) : null}
        </View>

        {/* Preferences */}
        <Text style={[styles.sectionTitle, { color: theme.accent, fontFamily: fonts.heading }]}>
          Preferences
        </Text>
        <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <Text style={[styles.rowLabel, { color: theme.textMuted, fontFamily: fonts.body, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }]}>
            Theme
          </Text>
          <View style={styles.themeRow}>
            {themeNames.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.themeChip,
                  {
                    backgroundColor: themes[key].accent + '20',
                    borderColor: currentTheme === key ? themes[key].accent : 'transparent',
                  },
                ]}
                onPress={() => setTheme(key)}
              >
                <View style={[styles.themeDot, { backgroundColor: themes[key].accent }]} />
                <Text
                  style={[
                    styles.themeLabel,
                    {
                      color: currentTheme === key ? themes[key].accent : theme.textMuted,
                      fontFamily: fonts.body,
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.rowLabel, { color: theme.textMuted, fontFamily: fonts.body }]}>
              Notification Sound
            </Text>
            <Switch
              value={auth.soundEnabled}
              onValueChange={handleSoundToggle}
              trackColor={{ false: theme.surface, true: theme.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.rowLabel, { color: theme.textMuted, fontFamily: fonts.body }]}>
              Online Presence
            </Text>
            <Switch
              value={auth.showPresence}
              onValueChange={handlePresenceToggle}
              trackColor={{ false: theme.surface, true: theme.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.rowLabel, { color: theme.textMuted, fontFamily: fonts.body }]}>
              Discoverable by Handle
            </Text>
            <Switch
              value={auth.discoverable}
              onValueChange={handleDiscoverabilityToggle}
              trackColor={{ false: theme.surface, true: theme.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Local Storage */}
        <Text style={[styles.sectionTitle, { color: theme.accent, fontFamily: fonts.heading }]}>
          Local Storage
        </Text>
        <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={styles.switchRow}>
            <Text style={[styles.rowLabel, { color: theme.textMuted, fontFamily: fonts.body }]}>
              Save Messages Locally
            </Text>
            <Switch
              value={auth.archiveEnabled}
              onValueChange={handleArchiveToggle}
              trackColor={{ false: theme.surface, true: theme.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Account */}
        <Text style={[styles.sectionTitle, { color: theme.accent, fontFamily: fonts.heading }]}>
          Account
        </Text>
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: '#ff4444' }]}
          onPress={handleLogout}
        >
          <Text style={[styles.logoutText, { fontFamily: fonts.bodySemiBold }]}>
            Log Out
          </Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: theme.textMuted, fontFamily: fonts.mono }]}>
          DissolveChat v0.2.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 28 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
  },
  card: {
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 13, maxWidth: '50%', textAlign: 'right' },
  rowAction: { fontSize: 14 },
  mnemonicBox: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
  },
  mnemonicText: { fontSize: 13, lineHeight: 20 },
  mnemonicWarn: { fontSize: 12, marginTop: 8 },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  themeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  themeLabel: { fontSize: 13 },
  logoutBtn: {
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#ff4444', fontSize: 16 },
  version: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 24,
  },
});
