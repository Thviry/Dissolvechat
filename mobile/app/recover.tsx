import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useContext, useState } from 'react';
import { AuthContext, ThemeContext } from './_layout';
import { fonts } from '../src/theme/fonts';

export default function RecoverScreen() {
  const router = useRouter();
  const auth = useContext(AuthContext)!;
  const theme = useContext(ThemeContext);

  const [seedPhrase, setSeedPhrase] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRecover = async () => {
    const trimmed = seedPhrase.trim();
    const words = trimmed.split(/\s+/);
    if (words.length !== 12) {
      return Alert.alert('Error', 'Please enter all 12 words of your recovery phrase');
    }

    setLoading(true);
    try {
      await auth.recover(trimmed, displayName || undefined);
      router.replace('/(tabs)/chats');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to recover identity');
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
        Recover Identity
      </Text>
      <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: fonts.body }]}>
        Enter your 12-word recovery phrase to restore your identity.
      </Text>

      <Text style={[styles.label, { color: theme.textMuted, fontFamily: fonts.body }]}>
        Recovery Phrase
      </Text>
      <TextInput
        style={[styles.textArea, { color: theme.text, borderColor: theme.border, fontFamily: fonts.mono }]}
        placeholder="word1 word2 word3 ..."
        placeholderTextColor={theme.textMuted}
        value={seedPhrase}
        onChangeText={setSeedPhrase}
        multiline
        numberOfLines={4}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={[styles.label, { color: theme.textMuted, fontFamily: fonts.body }]}>
        Display Name (optional)
      </Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, fontFamily: fonts.body }]}
        placeholder="e.g. Alice"
        placeholderTextColor={theme.textMuted}
        value={displayName}
        onChangeText={setDisplayName}
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.accent, opacity: loading ? 0.5 : 1 }]}
        onPress={handleRecover}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
          {loading ? 'Recovering...' : 'Recover Identity'}
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
  textArea: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: { padding: 16, borderRadius: 4, alignItems: 'center', marginTop: 24 },
  buttonText: { fontSize: 16 },
});
