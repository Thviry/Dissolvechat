import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useContext, useState } from 'react';
import { AuthContext, ThemeContext } from './_layout';
import { fonts } from '../src/theme/fonts';

export default function CreateScreen() {
  const router = useRouter();
  const auth = useContext(AuthContext)!;
  const theme = useContext(ThemeContext);

  const [handle, setHandle] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!passphrase) return Alert.alert('Error', 'Passphrase is required');
    if (passphrase !== confirmPass) return Alert.alert('Error', 'Passphrases do not match');
    if (passphrase.length < 6) return Alert.alert('Error', 'Passphrase must be at least 6 characters');

    setLoading(true);
    try {
      const result = await auth.enroll(handle || 'Me', passphrase, handle || undefined);
      setMnemonic(result.mnemonic);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create identity');
    } finally {
      setLoading(false);
    }
  };

  if (mnemonic) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.void }]} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.accent, fontFamily: fonts.heading }]}>
          Recovery Phrase
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: fonts.body }]}>
          Write these 12 words down and store them safely. They are the only way to recover your identity.
        </Text>

        <View style={[styles.mnemonicBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {mnemonic.split(' ').map((word, i) => (
            <View key={i} style={styles.wordRow}>
              <Text style={[styles.wordNum, { color: theme.textMuted, fontFamily: fonts.mono }]}>
                {i + 1}.
              </Text>
              <Text style={[styles.word, { color: theme.text, fontFamily: fonts.mono }]}>
                {word}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={() => router.replace('/(tabs)/chats')}
        >
          <Text style={[styles.buttonText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
            I've saved this — Continue
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.void }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={[styles.back, { color: theme.textMuted, fontFamily: fonts.body }]}>
          ← Back
        </Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: theme.text, fontFamily: fonts.heading }]}>
        Create Identity
      </Text>

      <Text style={[styles.label, { color: theme.textMuted, fontFamily: fonts.body }]}>
        Handle (optional)
      </Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, fontFamily: fonts.body }]}
        placeholder="e.g. alice"
        placeholderTextColor={theme.textMuted}
        value={handle}
        onChangeText={setHandle}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={[styles.label, { color: theme.textMuted, fontFamily: fonts.body }]}>
        Passphrase
      </Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, fontFamily: fonts.body }]}
        placeholder="Strong passphrase"
        placeholderTextColor={theme.textMuted}
        value={passphrase}
        onChangeText={setPassphrase}
        secureTextEntry
      />

      <Text style={[styles.label, { color: theme.textMuted, fontFamily: fonts.body }]}>
        Confirm Passphrase
      </Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, fontFamily: fonts.body }]}
        placeholder="Repeat passphrase"
        placeholderTextColor={theme.textMuted}
        value={confirmPass}
        onChangeText={setConfirmPass}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.accent, opacity: loading ? 0.5 : 1 }]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
          {loading ? 'Creating...' : 'Create Identity'}
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
  subtitle: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
    fontSize: 16,
  },
  button: { padding: 16, borderRadius: 4, alignItems: 'center', marginTop: 24 },
  buttonText: { fontSize: 16 },
  mnemonicBox: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 16,
    marginVertical: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordRow: { flexDirection: 'row', width: '45%', marginBottom: 4 },
  wordNum: { fontSize: 14, width: 28, textAlign: 'right', marginRight: 6 },
  word: { fontSize: 14 },
});
