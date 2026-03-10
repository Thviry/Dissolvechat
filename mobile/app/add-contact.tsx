import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useContext, useState, useEffect } from 'react';
import { AuthContext, ThemeContext } from './_layout';
import { fonts } from '../src/theme/fonts';
import {
  lookupDirectory,
  buildContactRequest,
  sendEnvelope,
} from '../src/adapters/relay';

export default function AddContactScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ data?: string }>();
  const auth = useContext(AuthContext)!;
  const theme = useContext(ThemeContext);

  const [handle, setHandle] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [sending, setSending] = useState(false);

  // Handle deep link: dissolve://contact?data=...
  useEffect(() => {
    if (params.data) {
      try {
        const contactData = JSON.parse(decodeURIComponent(params.data));
        if (contactData?.handle) {
          setHandle(contactData.handle);
          setResult(contactData);
        }
      } catch {
        // Invalid data param — ignore
      }
    }
  }, [params.data]);

  const handleSearch = async () => {
    const trimmed = handle.trim().toLowerCase();
    if (!trimmed) return;

    setSearching(true);
    setResult(null);
    try {
      const entry = await lookupDirectory(trimmed);
      if (entry) {
        setResult(entry);
      } else {
        Alert.alert('Not Found', `No user found with handle "${trimmed}"`);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to search. Check your connection.');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!result) return;
    setSending(true);
    try {
      const envelope = await buildContactRequest(
        auth.id,
        auth.label,
        auth.authPubJwk,
        auth.authPrivKey,
        auth.e2eePubJwk,
        auth.inboxCap,
        {
          id: result.id,
          e2eePublicJwk: result.e2eePublicJwk || result.e2ee?.publicJwk,
          requestCap: result.requestCap,
        }
      );
      await sendEnvelope(envelope);

      // Save as outgoing request locally
      const requests = await (await import('../src/adapters/storage')).appStorage.getJson<any[]>(`requests:${auth.id}`) || [];
      requests.push({
        id: result.id,
        label: result.label || result.handle,
        handle: result.handle,
        e2eePublicJwk: result.e2eePublicJwk || result.e2ee?.publicJwk,
        dir: 'outgoing',
      });
      await (await import('../src/adapters/storage')).appStorage.setJson(`requests:${auth.id}`, requests);

      Alert.alert('Request Sent', `Contact request sent to @${result.handle || handle}`);
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.void }]}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={[styles.back, { color: theme.textMuted, fontFamily: fonts.body }]}>
          ← Back
        </Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: theme.text, fontFamily: fonts.heading }]}>
        Add Contact
      </Text>
      <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: fonts.body }]}>
        Search for someone by their handle.
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, fontFamily: fonts.body }]}
          placeholder="Enter handle"
          placeholderTextColor={theme.textMuted}
          value={handle}
          onChangeText={setHandle}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: theme.accent, opacity: searching ? 0.5 : 1 }]}
          onPress={handleSearch}
          disabled={searching}
        >
          {searching ? (
            <ActivityIndicator color={theme.void} size="small" />
          ) : (
            <Text style={[styles.searchBtnText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
              Search
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {result && (
        <View style={[styles.resultCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.resultAvatar, { backgroundColor: theme.secondary }]}>
            <Text style={[styles.resultAvatarText, { color: theme.accent, fontFamily: fonts.heading }]}>
              {(result.handle || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.resultInfo}>
            <Text style={[styles.resultHandle, { color: theme.text, fontFamily: fonts.bodySemiBold }]}>
              @{result.handle}
            </Text>
            <Text style={[styles.resultId, { color: theme.textMuted, fontFamily: fonts.mono }]}>
              {result.id?.slice(0, 16)}...
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.requestBtn, { backgroundColor: theme.accent, opacity: sending ? 0.5 : 1 }]}
            onPress={handleSendRequest}
            disabled={sending}
          >
            <Text style={[styles.requestBtnText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
              {sending ? 'Sending...' : 'Send Request'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  back: { fontSize: 16, marginBottom: 24 },
  title: { fontSize: 24, marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
    fontSize: 16,
  },
  searchBtn: {
    paddingHorizontal: 20,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: { fontSize: 15 },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    borderRadius: 4,
  },
  resultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultAvatarText: { fontSize: 18 },
  resultInfo: { flex: 1 },
  resultHandle: { fontSize: 16 },
  resultId: { fontSize: 11, marginTop: 2 },
  requestBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  requestBtnText: { fontSize: 13 },
});
