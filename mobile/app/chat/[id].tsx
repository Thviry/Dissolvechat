import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useContext, useState, useRef, useEffect, useCallback } from 'react';
import { AuthContext, ThemeContext } from '../_layout';
import { MessageBubble } from '../../src/components/MessageBubble';
import { ChatInput } from '../../src/components/ChatInput';
import { fonts } from '../../src/theme/fonts';
import { appStorage } from '../../src/adapters/storage';
import {
  buildMessage,
  buildGroupMessage,
  sendEnvelope,
} from '../../src/adapters/relay';

interface Message {
  msgId: string;
  text: string;
  ts: number;
  dir: 'sent' | 'received';
  peerId: string;
  senderName?: string;
  file?: { name: string; mimeType: string; size: number; data: string };
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auth = useContext(AuthContext)!;
  const theme = useContext(ThemeContext);

  const [messages, setMessages] = useState<Message[]>([]);
  const [contactName, setContactName] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Load contact/group name and message history
  useEffect(() => {
    if (!auth.id || !id) return;

    (async () => {
      // Check if this is a group
      const groups = await appStorage.getJson<any[]>(`groups:${auth.id}`) || [];
      const group = groups.find((g: any) => g.groupId === id);
      if (group) {
        setIsGroup(true);
        setContactName(group.name || 'Group');
        return;
      }

      // Otherwise it's a 1-to-1 contact
      const contacts = await appStorage.getJson<any[]>(`contacts:${auth.id}`) || [];
      const contact = contacts.find((c: any) => (c.id || c.peerId) === id);
      setContactName(contact?.label || contact?.handle || id?.slice(0, 8) || '');
    })();
  }, [auth.id, id]);

  const handleSend = useCallback(async (text: string, file?: { name: string; mimeType: string; size: number; data: string }) => {
    if (!text && !file) return;
    setSending(true);

    try {
      // Add to local messages optimistically
      const newMsg: Message = {
        msgId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        ts: Date.now(),
        dir: 'sent',
        peerId: id!,
        file,
      };
      setMessages(prev => [...prev, newMsg]);

      if (isGroup) {
        // Group message: encrypt with group key, fan out to members
        const groups = await appStorage.getJson<any[]>(`groups:${auth.id}`) || [];
        const group = groups.find((g: any) => g.groupId === id);
        if (group?.groupKey && group?.members) {
          const { envelopes } = await buildGroupMessage(
            auth.id, auth.label, auth.authPubJwk, auth.authPrivKey,
            auth.e2eePubJwk, auth.inboxCap,
            id!, group.groupKey, group.members, text, file
          );
          await Promise.allSettled(
            envelopes.map((e: any) => sendEnvelope(e.envelope))
          );
        }
      } else {
        // 1-to-1 message: encrypt for peer
        const contacts = await appStorage.getJson<any[]>(`contacts:${auth.id}`) || [];
        const peer = contacts.find((c: any) => (c.id || c.peerId) === id);
        if (peer?.e2eePublicJwk && peer?.cap) {
          const { envelope } = await buildMessage(
            auth.id, auth.label, auth.authPubJwk, auth.authPrivKey,
            auth.e2eePubJwk, auth.inboxCap,
            { id: peer.id || peer.peerId, e2eePublicJwk: peer.e2eePublicJwk, cap: peer.cap },
            text, file
          );
          await sendEnvelope(envelope);
        }
      }
    } catch (err) {
      console.warn('[Chat] Send failed:', err);
    } finally {
      setSending(false);
    }
  }, [id]);

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble
      text={item.text}
      timestamp={item.ts}
      isOwn={item.dir === 'sent'}
      senderName={item.senderName}
      isGroup={isGroup}
      file={item.file}
    />
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.void }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.secondary, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: theme.accent, fontFamily: fonts.body }]}>
            ←
          </Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: theme.text, fontFamily: fonts.bodySemiBold }]} numberOfLines={1}>
            {isGroup ? `# ${contactName}` : contactName}
          </Text>
        </View>
        {isGroup && (
          <TouchableOpacity
            onPress={() => router.push(`/group-info/${id}`)}
            style={styles.infoBtn}
          >
            <Text style={[styles.infoText, { color: theme.textMuted, fontFamily: fonts.body }]}>
              info
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      {messages.length === 0 ? (
        <View style={styles.emptyChat}>
          <Text style={[styles.emptyChatText, { color: theme.textMuted, fontFamily: fonts.body }]}>
            {isGroup
              ? 'No messages in this group yet.'
              : 'Start your encrypted conversation.'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.msgId}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={sending} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  backText: { fontSize: 24 },
  headerInfo: { flex: 1, marginLeft: 8 },
  headerName: { fontSize: 17 },
  infoBtn: { padding: 8 },
  infoText: { fontSize: 14 },
  messageList: { paddingVertical: 8 },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyChatText: { fontSize: 15, textAlign: 'center' },
});
