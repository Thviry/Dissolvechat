import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useContext, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { AuthContext, ThemeContext } from './_layout';
import { fonts } from '../src/theme/fonts';
import { appStorage } from '../src/adapters/storage';

export default function LoginScreen() {
  const router = useRouter();
  const auth = useContext(AuthContext)!;
  const theme = useContext(ThemeContext);

  const [keyfileContent, setKeyfileContent] = useState<string | null>(null);
  const [keyfileName, setKeyfileName] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);

  const pickKeyfile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri);
      setKeyfileContent(content);
      setKeyfileName(asset.name);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to read key file');
    }
  };

  const handleLogin = async () => {
    if (!keyfileContent) return Alert.alert('Error', 'Please select a key file');
    if (!passphrase) return Alert.alert('Error', 'Passphrase is required');

    setLoading(true);
    try {
      const { userId, importedContacts, importedGroups } = await auth.login(keyfileContent, passphrase);

      // Restore contacts and groups from keyfile
      if (importedContacts.length > 0) {
        await appStorage.setJson(`contacts:${userId}`, importedContacts);
      }
      if (importedGroups.length > 0) {
        await appStorage.setJson(`groups:${userId}`, importedGroups);
      }

      router.replace('/(tabs)/chats');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.void }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={[styles.back, { color: theme.textMuted, fontFamily: fonts.body }]}>
          ← Back
        </Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: theme.text, fontFamily: fonts.heading }]}>
        Log In
      </Text>
      <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: fonts.body }]}>
        Select your key file and enter your passphrase.
      </Text>

      <TouchableOpacity
        style={[styles.filePicker, { borderColor: theme.border, backgroundColor: theme.surface }]}
        onPress={pickKeyfile}
      >
        <Text style={[styles.filePickerText, { color: keyfileName ? theme.text : theme.textMuted, fontFamily: fonts.body }]}>
          {keyfileName || 'Tap to select key file (.usbkey.json)'}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.label, { color: theme.textMuted, fontFamily: fonts.body }]}>
        Passphrase
      </Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, fontFamily: fonts.body }]}
        placeholder="Enter your passphrase"
        placeholderTextColor={theme.textMuted}
        value={passphrase}
        onChangeText={setPassphrase}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.accent, opacity: loading ? 0.5 : 1 }]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
          {loading ? 'Decrypting...' : 'Log In'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60 },
  back: { fontSize: 16, marginBottom: 24 },
  title: { fontSize: 24, marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 24, color: '#888' },
  label: { fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
    fontSize: 16,
  },
  filePicker: {
    borderWidth: 1,
    borderRadius: 4,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
  },
  filePickerText: { fontSize: 14 },
  button: { padding: 16, borderRadius: 4, alignItems: 'center', marginTop: 24 },
  buttonText: { fontSize: 16 },
});
