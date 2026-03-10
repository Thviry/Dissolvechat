import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useContext, useState, useEffect } from 'react';
import { AuthContext, ThemeContext } from './_layout';
import { fonts } from '../src/theme/fonts';
import { appStorage } from '../src/adapters/storage';
import { buildGroupInvite, sendEnvelope } from '../src/adapters/relay';

interface Contact {
  id: string;
  label?: string;
  handle?: string;
  e2eePublicJwk?: JsonWebKey;
}

export default function CreateGroupScreen() {
  const router = useRouter();
  const auth = useContext(AuthContext)!;
  const theme = useContext(ThemeContext);

  const [groupName, setGroupName] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!auth.id) return;
    appStorage.getJson<any[]>(`contacts:${auth.id}`).then((stored) => {
      setContacts((stored || []).filter((c: any) => c.e2eePublicJwk));
    });
  }, [auth.id]);

  const toggleContact = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!groupName.trim()) return Alert.alert('Error', 'Group name is required');
    if (selected.size === 0) return Alert.alert('Error', 'Select at least one contact');
    if (selected.size > 49) return Alert.alert('Error', 'Maximum 50 members (including you)');

    setCreating(true);
    try {
      // Generate group key and create group
      const { generateGroupKey } = await import('dissolve-core/crypto/group');
      const groupKeyB64 = await generateGroupKey();
      const groupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Build member list with full key data
      const allContacts = await appStorage.getJson<any[]>(`contacts:${auth.id}`) || [];
      const memberObjs = Array.from(selected).map(memberId => {
        const c = allContacts.find((ct: any) => ct.id === memberId);
        return {
          id: memberId,
          label: c?.label || c?.handle || memberId.slice(0, 8),
          e2eePublicJwk: c?.e2eePublicJwk,
          authPublicJwk: c?.authPublicJwk,
          cap: c?.cap,
          role: 'member' as const,
        };
      });

      // Add self as admin
      const selfMember = {
        id: auth.id,
        label: auth.label,
        e2eePublicJwk: auth.e2eePubJwk,
        authPublicJwk: auth.authPubJwk,
        cap: auth.inboxCap,
        role: 'admin' as const,
      };
      const allMembers = [selfMember, ...memberObjs];

      // Save group locally
      const groups = await appStorage.getJson<any[]>(`groups:${auth.id}`) || [];
      groups.push({
        groupId,
        name: groupName.trim(),
        groupKey: groupKeyB64,
        members: allMembers,
        admins: [auth.id],
        creator: auth.id,
        createdAt: Date.now(),
      });
      await appStorage.setJson(`groups:${auth.id}`, groups);

      // Send invite to each member
      await Promise.allSettled(
        memberObjs.filter(m => m.e2eePublicJwk && m.cap).map(async (member) => {
          const { envelope } = await buildGroupInvite(
            auth.id, auth.label, auth.authPubJwk, auth.authPrivKey,
            auth.e2eePubJwk, auth.inboxCap,
            groupId, groupName.trim(), groupKeyB64,
            allMembers, auth.id, member
          );
          return sendEnvelope(envelope);
        })
      );

      router.replace(`/chat/${groupId}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const isSelected = selected.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.contactRow, { borderBottomColor: theme.border }]}
        onPress={() => toggleContact(item.id)}
      >
        <View style={[
          styles.checkbox,
          {
            borderColor: isSelected ? theme.accent : theme.border,
            backgroundColor: isSelected ? theme.accent : 'transparent',
          },
        ]}>
          {isSelected && (
            <Text style={[styles.checkmark, { color: theme.void }]}>✓</Text>
          )}
        </View>
        <Text style={[styles.contactName, { color: theme.text, fontFamily: fonts.body }]}>
          {item.label || item.handle || item.id.slice(0, 8)}
        </Text>
        {item.handle && (
          <Text style={[styles.contactHandle, { color: theme.textMuted, fontFamily: fonts.mono }]}>
            @{item.handle}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.void }]}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={[styles.back, { color: theme.textMuted, fontFamily: fonts.body }]}>
          ← Back
        </Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: theme.text, fontFamily: fonts.heading }]}>
        Create Group
      </Text>

      <Text style={[styles.label, { color: theme.textMuted, fontFamily: fonts.body }]}>
        Group Name
      </Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, fontFamily: fonts.body }]}
        placeholder="e.g. Project Team"
        placeholderTextColor={theme.textMuted}
        value={groupName}
        onChangeText={setGroupName}
      />

      <Text style={[styles.label, { color: theme.textMuted, fontFamily: fonts.body }]}>
        Select Members ({selected.size} selected)
      </Text>

      {contacts.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: fonts.body }]}>
          No contacts available. Add contacts first.
        </Text>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContact}
          style={styles.list}
        />
      )}

      <TouchableOpacity
        style={[styles.createBtn, { backgroundColor: theme.accent, opacity: creating ? 0.5 : 1 }]}
        onPress={handleCreate}
        disabled={creating}
      >
        <Text style={[styles.createBtnText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
          {creating ? 'Creating...' : 'Create Group'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  back: { fontSize: 16, marginBottom: 24 },
  title: { fontSize: 24, marginBottom: 16 },
  label: { fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
    fontSize: 16,
  },
  list: { flex: 1, marginTop: 8 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkmark: { fontSize: 14, fontWeight: 'bold' },
  contactName: { fontSize: 15, flex: 1 },
  contactHandle: { fontSize: 12 },
  emptyText: { fontSize: 14, marginTop: 12 },
  createBtn: {
    padding: 16,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  createBtnText: { fontSize: 16 },
});
