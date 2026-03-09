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

        <TouchableOpacity onPress={() => router.push('/recover')}>
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
