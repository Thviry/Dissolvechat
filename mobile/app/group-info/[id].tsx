import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useContext, useState, useEffect } from 'react';
import { AuthContext, ThemeContext } from '../_layout';
import { fonts } from '../../src/theme/fonts';
import { appStorage } from '../../src/adapters/storage';
import {
  buildGroupMemberRemoved,
  buildGroupLeave,
  sendEnvelope,
} from '../../src/adapters/relay';

interface GroupData {
  groupId: string;
  name: string;
  members: string[];
  admins: string[];
  createdAt: number;
}

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auth = useContext(AuthContext)!;
  const theme = useContext(ThemeContext);

  const [group, setGroup] = useState<GroupData | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.id || !id) return;
    (async () => {
      const groups = await appStorage.getJson<GroupData[]>(`groups:${auth.id}`) || [];
      const found = groups.find((g) => g.groupId === id);
      setGroup(found || null);

      const stored = await appStorage.getJson<any[]>(`contacts:${auth.id}`) || [];
      setContacts(stored);
    })();
  }, [auth.id, id]);

  if (!group) {
    return (
      <View style={[styles.container, { backgroundColor: theme.void }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: theme.textMuted, fontFamily: fonts.body }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textMuted, fontFamily: fonts.body }]}>Group not found</Text>
      </View>
    );
  }

  const isAdmin = group.admins.includes(auth.id);

  const getMemberName = (memberId: string) => {
    if (memberId === auth.id) return 'You';
    const contact = contacts.find((c) => (c.id || c.peerId) === memberId);
    return contact?.label || contact?.handle || memberId.slice(0, 8);
  };

  const handleRemoveMember = (memberId: string) => {
    Alert.alert(
      'Remove Member',
      `Remove ${getMemberName(memberId)} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const groups = await appStorage.getJson<any[]>(`groups:${auth.id}`) || [];
              const idx = groups.findIndex((g: any) => g.groupId === id);
              if (idx < 0) return;

              const grp = groups[idx];
              // Generate rotated group key
              const { generateGroupKey } = await import('dissolve-core/crypto/group');
              const newGroupKey = await generateGroupKey();

              // Update local state
              const updatedMembers = (grp.members || []).filter((m: any) =>
                typeof m === 'string' ? m !== memberId : m.id !== memberId
              );
              groups[idx].members = updatedMembers;
              groups[idx].admins = (grp.admins || []).filter((a: string) => a !== memberId);
              groups[idx].groupKey = newGroupKey;
              await appStorage.setJson(`groups:${auth.id}`, groups);
              setGroup({ ...groups[idx] });

              // Notify remaining members via relay
              await Promise.allSettled(
                updatedMembers
                  .filter((m: any) => {
                    const mid = typeof m === 'string' ? m : m.id;
                    return mid !== auth.id && m.e2eePublicJwk && m.cap;
                  })
                  .map(async (member: any) => {
                    const { envelope } = await buildGroupMemberRemoved(
                      auth.id, auth.label, auth.authPubJwk, auth.authPrivKey,
                      id!, memberId, newGroupKey, updatedMembers, member
                    );
                    return sendEnvelope(envelope);
                  })
              );
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const groups = await appStorage.getJson<any[]>(`groups:${auth.id}`) || [];
              const grp = groups.find((g: any) => g.groupId === id);

              // Notify other members via relay
              if (grp?.members) {
                await Promise.allSettled(
                  (grp.members || [])
                    .filter((m: any) => {
                      const mid = typeof m === 'string' ? m : m.id;
                      return mid !== auth.id && m.e2eePublicJwk && m.cap;
                    })
                    .map(async (member: any) => {
                      const { envelope } = await buildGroupLeave(
                        auth.id, auth.label, auth.authPubJwk, auth.authPrivKey,
                        id!, member
                      );
                      return sendEnvelope(envelope);
                    })
                );
              }

              // Remove group locally
              const filtered = groups.filter((g: any) => g.groupId !== id);
              await appStorage.setJson(`groups:${auth.id}`, filtered);
              router.replace('/(tabs)/chats');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to leave group');
            }
          },
        },
      ]
    );
  };

  const renderMember = ({ item: memberId }: { item: string }) => {
    const isMemberAdmin = group.admins.includes(memberId);
    const isMe = memberId === auth.id;

    return (
      <View style={[styles.memberRow, { borderBottomColor: theme.border }]}>
        <View style={[styles.memberAvatar, { backgroundColor: theme.surface }]}>
          <Text style={[styles.memberAvatarText, { color: theme.accent, fontFamily: fonts.heading }]}>
            {getMemberName(memberId).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={[styles.memberName, { color: theme.text, fontFamily: fonts.bodySemiBold }]}>
            {getMemberName(memberId)}
          </Text>
          {isMemberAdmin && (
            <Text style={[styles.adminBadge, { color: theme.accent, fontFamily: fonts.mono }]}>
              admin
            </Text>
          )}
        </View>
        {isAdmin && !isMe && (
          <TouchableOpacity onPress={() => handleRemoveMember(memberId)}>
            <Text style={[styles.removeText, { color: theme.textMuted, fontFamily: fonts.body }]}>
              Remove
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.void }]}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={[styles.back, { color: theme.textMuted, fontFamily: fonts.body }]}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: theme.text, fontFamily: fonts.heading }]}>
        {group.name}
      </Text>
      <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: fonts.mono }]}>
        {group.members.length} members
      </Text>

      <Text style={[styles.sectionTitle, { color: theme.textMuted, fontFamily: fonts.bodySemiBold }]}>
        MEMBERS
      </Text>

      <FlatList
        data={group.members}
        keyExtractor={(item) => item}
        renderItem={renderMember}
        style={styles.list}
      />

      {isAdmin && (
        <TouchableOpacity
          style={[styles.addMemberBtn, { borderColor: theme.accent }]}
          onPress={() => {
            router.push({ pathname: '/add-contact', params: { groupId: id } });
          }}
        >
          <Text style={[styles.addMemberText, { color: theme.accent, fontFamily: fonts.bodySemiBold }]}>
            + Add Member
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.leaveBtn, { borderColor: '#ff4444' }]}
        onPress={handleLeave}
      >
        <Text style={[styles.leaveText, { color: '#ff4444', fontFamily: fonts.bodySemiBold }]}>
          Leave Group
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  back: { fontSize: 16, marginBottom: 24 },
  title: { fontSize: 24, marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 24 },
  sectionTitle: { fontSize: 13, letterSpacing: 1, marginBottom: 8 },
  list: { flex: 1 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: { fontSize: 15 },
  memberInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 15 },
  adminBadge: { fontSize: 11 },
  removeText: { fontSize: 13 },
  addMemberBtn: {
    padding: 14,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 16,
  },
  addMemberText: { fontSize: 15 },
  leaveBtn: {
    padding: 14,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  leaveText: { fontSize: 15 },
});
