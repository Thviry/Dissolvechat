import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useContext, useState, useCallback, useEffect } from 'react';
import { AuthContext, ThemeContext } from '../_layout';
import { fonts } from '../../src/theme/fonts';
import { appStorage } from '../../src/adapters/storage';

interface ConversationItem {
  id: string;          // peerId or groupId
  name: string;
  lastMessage: string;
  lastTs: number;
  unread: number;
  isGroup: boolean;
  isOnline?: boolean;
}

export default function ChatsScreen() {
  const router = useRouter();
  const auth = useContext(AuthContext)!;
  const theme = useContext(ThemeContext);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Load conversations from stored messages/contacts
  const loadConversations = useCallback(async () => {
    if (!auth.id) return;
    try {
      const contacts = await appStorage.getJson<any[]>(`contacts:${auth.id}`) || [];
      const groups = await appStorage.getJson<any[]>(`groups:${auth.id}`) || [];

      const convs: ConversationItem[] = [
        ...contacts.map((c: any) => ({
          id: c.id || c.peerId,
          name: c.label || c.handle || c.id?.slice(0, 8),
          lastMessage: '',
          lastTs: 0,
          unread: 0,
          isGroup: false,
        })),
        ...groups.map((g: any) => ({
          id: g.groupId,
          name: g.name || 'Group',
          lastMessage: '',
          lastTs: g.createdAt || 0,
          unread: 0,
          isGroup: true,
        })),
      ];

      // Sort by most recent activity
      convs.sort((a, b) => b.lastTs - a.lastTs);
      setConversations(convs);
    } catch (err) {
      console.warn('[Chats] Failed to load conversations:', err);
    }
  }, [auth.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, [loadConversations]);

  const formatTime = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item }: { item: ConversationItem }) => (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: theme.border }]}
      onPress={() => router.push(`/chat/${item.id}`)}
    >
      <View style={[styles.avatar, { backgroundColor: theme.surface }]}>
        <Text style={[styles.avatarText, { color: theme.accent, fontFamily: fonts.heading }]}>
          {item.isGroup ? '#' : item.name.charAt(0).toUpperCase()}
        </Text>
        {item.isOnline && <View style={[styles.presenceDot, { backgroundColor: theme.accent }]} />}
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, { color: theme.text, fontFamily: fonts.bodySemiBold }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.time, { color: theme.textMuted, fontFamily: fonts.mono }]}>
            {formatTime(item.lastTs)}
          </Text>
        </View>
        {item.lastMessage ? (
          <Text style={[styles.preview, { color: theme.textMuted, fontFamily: fonts.body }]} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        ) : null}
      </View>
      {item.unread > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <Text style={[styles.badgeText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
            {item.unread}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.void }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text, fontFamily: fonts.heading }]}>
          Chats
        </Text>
        <TouchableOpacity
          style={[styles.newGroupBtn, { backgroundColor: theme.accent }]}
          onPress={() => router.push('/create-group')}
        >
          <Text style={[styles.newGroupText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
            + Group
          </Text>
        </TouchableOpacity>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: fonts.body }]}>
            No conversations yet.
          </Text>
          <Text style={[styles.emptyHint, { color: theme.textMuted, fontFamily: fonts.body }]}>
            Add a contact to start chatting.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
            />
          }
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
  newGroupBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  newGroupText: { fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, marginBottom: 8 },
  emptyHint: { fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18 },
  presenceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, flex: 1, marginRight: 8 },
  time: { fontSize: 11 },
  preview: { fontSize: 14, marginTop: 2 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: { fontSize: 11 },
});
