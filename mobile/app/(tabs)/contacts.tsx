import { View, Text, SectionList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useContext, useState, useEffect, useCallback } from 'react';
import { AuthContext, ThemeContext } from '../_layout';
import { ContactRow } from '../../src/components/ContactRow';
import { fonts } from '../../src/theme/fonts';
import { appStorage } from '../../src/adapters/storage';

interface Contact {
  id: string;
  label?: string;
  handle?: string;
  e2eePublicJwk?: JsonWebKey;
}

interface Request {
  id: string;
  label?: string;
  handle?: string;
  dir: 'incoming' | 'outgoing';
}

export default function ContactsScreen() {
  const router = useRouter();
  const auth = useContext(AuthContext)!;
  const theme = useContext(ThemeContext);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);

  const loadContacts = useCallback(async () => {
    if (!auth.id) return;
    const stored = await appStorage.getJson<any[]>(`contacts:${auth.id}`) || [];
    setContacts(stored.filter((c: any) => c.granted || c.e2eePublicJwk));

    const storedReqs = await appStorage.getJson<any[]>(`requests:${auth.id}`) || [];
    setRequests(storedReqs);
  }, [auth.id]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const sections = [
    ...(requests.length > 0
      ? [{ title: 'Requests', data: requests.map(r => ({ ...r, isRequest: true })) }]
      : []),
    ...(contacts.length > 0
      ? [{ title: 'Contacts', data: contacts.map(c => ({ ...c, isRequest: false })) }]
      : []),
  ];

  const handleAccept = async (_requestId: string) => {
    // TODO: Wire up sendGrant via relay
  };

  const handleDecline = async (_requestId: string) => {
    // TODO: Wire up decline via relay
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.void }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text, fontFamily: fonts.heading }]}>
          Contacts
        </Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.accent }]}
          onPress={() => router.push('/add-contact')}
        >
          <Text style={[styles.addBtnText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
            + Add
          </Text>
        </TouchableOpacity>
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: fonts.body }]}>
            No contacts yet.
          </Text>
          <Text style={[styles.emptyHint, { color: theme.textMuted, fontFamily: fonts.body }]}>
            Tap "+ Add" to find people by handle.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title } }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.void }]}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted, fontFamily: fonts.bodySemiBold }]}>
                {title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ContactRow
              name={item.label || item.handle || item.id.slice(0, 8)}
              handle={item.handle}
              isRequest={(item as any).isRequest}
              requestDir={(item as any).dir}
              onPress={() => {
                if (!(item as any).isRequest) {
                  router.push(`/chat/${item.id}`);
                }
              }}
              onAccept={() => handleAccept(item.id)}
              onDecline={() => handleDecline(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 28 },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  addBtnText: { fontSize: 14 },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, marginBottom: 8 },
  emptyHint: { fontSize: 14 },
});
