// Deep link handler — catches dissolve:// URLs and Universal Links
// dissolve://link?sid=...&pk=... → device linking flow
// dissolve://contact?data=... → add contact confirmation

import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';

export default function DeeplinkHandler() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const url = Linking.createURL('');

    // Get the original URL that opened this screen
    Linking.getInitialURL().then((initialUrl) => {
      handleUrl(initialUrl || '');
    });

    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, []);

  function handleUrl(url: string) {
    try {
      const parsed = Linking.parse(url);

      if (parsed.path === 'link' || parsed.hostname === 'link') {
        // Device linking: dissolve://link?sid=...&pk=...
        const sid = parsed.queryParams?.sid as string;
        const pk = parsed.queryParams?.pk as string;
        if (sid && pk) {
          router.replace({
            pathname: '/link-device',
            params: { sid, pk },
          });
          return;
        }
      }

      if (parsed.path === 'contact' || parsed.hostname === 'contact') {
        // Contact import: dissolve://contact?data=...
        const data = parsed.queryParams?.data as string;
        if (data) {
          router.replace({
            pathname: '/add-contact',
            params: { data },
          });
          return;
        }
      }

      // Unknown deep link — go to main screen
      router.replace('/');
    } catch {
      router.replace('/');
    }
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#39ff14" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
