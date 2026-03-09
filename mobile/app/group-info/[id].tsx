import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useContext, useState, useEffect } from 'react';
import { AuthContext, ThemeContext } from '../_layout';
import { fonts } from '../../src/theme/fonts';
import { appStorage } from '../../src/adapters/storage';

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
            // TODO: Wire up removeGroupMember via relay
            const groups = await appStorage.getJson<GroupData[]>(`groups:${auth.id}`) || [];
            const idx = groups.findIndex((g) => g.groupId === id);
            if (idx >= 0) {
              groups[idx].members = groups[idx].members.filter((m) => m !== memberId);
              groups[idx].admins = groups[idx].admins.filter((m) => m !== memberId);
              await appStorage.setJson(`groups:${auth.id}`, groups);
              setGroup({ ...groups[idx] });
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
            // TODO: Wire up leaveGroup via relay
            const groups = await appStorage.getJson<GroupData[]>(`groups:${auth.id}`) || [];
            const filtered = groups.filter((g) => g.groupId !== id);
            await appStorage.setJson(`groups:${auth.id}`, filtered);
            router.replace('/(tabs)/chats');
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
            // TODO: Navigate to add member screen
            Alert.alert('Coming Soon', 'Add member functionality will be wired up with relay integration.');
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
