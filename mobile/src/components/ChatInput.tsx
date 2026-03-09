import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useContext, useState } from 'react';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { ThemeContext } from '../../app/_layout';
import { fonts } from '../theme/fonts';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface Props {
  onSend: (text: string, file?: { name: string; mimeType: string; size: number; data: string }) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const theme = useContext(ThemeContext);
  const [text, setText] = useState('');

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(trimmed);
    setText('');
  };

  const handleAttach = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (asset.size && asset.size > MAX_FILE_SIZE) {
        // Silently ignore files over 5MB — could show alert instead
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSend('', {
        name: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
        size: asset.size || 0,
        data: base64,
      });
    } catch {
      // Picker cancelled or failed
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.secondary, borderTopColor: theme.border }]}>
      <TouchableOpacity style={styles.attachBtn} onPress={handleAttach} disabled={disabled}>
        <View style={[styles.attachIcon, { borderColor: theme.textMuted }]}>
          <View style={[styles.attachPlus, { backgroundColor: theme.textMuted }]} />
          <View style={[styles.attachPlusV, { backgroundColor: theme.textMuted }]} />
        </View>
      </TouchableOpacity>

      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: theme.surface, fontFamily: fonts.body }]}
        placeholder="Message"
        placeholderTextColor={theme.textMuted}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={10000}
        editable={!disabled}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
      />

      <TouchableOpacity
        style={[styles.sendBtn, { backgroundColor: text.trim() ? theme.accent : theme.surface }]}
        onPress={handleSend}
        disabled={disabled || !text.trim()}
      >
        <View style={styles.sendArrow}>
          <View style={[styles.arrowLine, { backgroundColor: text.trim() ? theme.void : theme.textMuted }]} />
          <View style={[styles.arrowHead, { borderColor: text.trim() ? theme.void : theme.textMuted }]} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    paddingBottom: 24, // safe area bottom
    borderTopWidth: 1,
    gap: 8,
  },
  attachBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  attachIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachPlus: { width: 10, height: 1.5, position: 'absolute' },
  attachPlusV: { width: 1.5, height: 10, position: 'absolute' },
  input: {
    flex: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendArrow: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowLine: { width: 12, height: 2, borderRadius: 1 },
  arrowHead: {
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    right: 0,
  },
});
