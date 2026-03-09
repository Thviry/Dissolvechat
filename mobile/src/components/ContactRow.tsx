import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useContext } from 'react';
import { ThemeContext } from '../../app/_layout';
import { fonts } from '../theme/fonts';

interface Props {
  name: string;
  handle?: string;
  isOnline?: boolean;
  isRequest?: boolean;
  requestDir?: 'incoming' | 'outgoing';
  onPress?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
}

export function ContactRow({ name, handle, isOnline, isRequest, requestDir, onPress, onAccept, onDecline }: Props) {
  const theme = useContext(ThemeContext);

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: theme.border }]}
      onPress={onPress}
      disabled={isRequest}
    >
      <View style={[styles.avatar, { backgroundColor: theme.surface }]}>
        <Text style={[styles.avatarText, { color: theme.accent, fontFamily: fonts.heading }]}>
          {name.charAt(0).toUpperCase()}
        </Text>
        {isOnline && <View style={[styles.presenceDot, { backgroundColor: theme.accent }]} />}
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.text, fontFamily: fonts.bodySemiBold }]} numberOfLines={1}>
          {name}
        </Text>
        {handle && (
          <Text style={[styles.handle, { color: theme.textMuted, fontFamily: fonts.mono }]}>
            @{handle}
          </Text>
        )}
        {isRequest && requestDir === 'outgoing' && (
          <Text style={[styles.status, { color: theme.textMuted, fontFamily: fonts.body }]}>
            Request sent
          </Text>
        )}
      </View>

      {isRequest && requestDir === 'incoming' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.accent }]}
            onPress={onAccept}
          >
            <Text style={[styles.actionText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
              Accept
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: theme.border, borderWidth: 1 }]}
            onPress={onDecline}
          >
            <Text style={[styles.actionText, { color: theme.textMuted, fontFamily: fonts.bodySemiBold }]}>
              Decline
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 16 },
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
  info: { flex: 1 },
  name: { fontSize: 16 },
  handle: { fontSize: 12, marginTop: 2 },
  status: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  actionText: { fontSize: 13 },
});
