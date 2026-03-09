import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useContext, useState } from 'react';
import { ThemeContext } from '../../app/_layout';
import { fonts } from '../theme/fonts';
import { ImagePreview } from './ImagePreview';

interface Props {
  text: string;
  timestamp: number;
  isOwn: boolean;
  senderName?: string;
  isGroup?: boolean;
  file?: { name: string; mimeType: string; size: number; data: string };
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export function MessageBubble({ text, timestamp, isOwn, senderName, isGroup, file }: Props) {
  const theme = useContext(ThemeContext);
  const [previewVisible, setPreviewVisible] = useState(false);

  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isImage = file && IMAGE_TYPES.has(file.mimeType);

  return (
    <View style={[
      styles.bubble,
      {
        backgroundColor: isOwn ? 'rgba(255,255,255,0.05)' : theme.surface,
        borderRightColor: isOwn ? theme.accent : 'transparent',
        borderRightWidth: isOwn ? 2 : 0,
        alignSelf: isOwn ? 'flex-end' : 'flex-start',
      },
    ]}>
      {isGroup && !isOwn && senderName && (
        <Text style={[styles.sender, { color: theme.accent, fontFamily: fonts.bodySemiBold }]}>
          {senderName}
        </Text>
      )}

      {isImage && (
        <>
          <TouchableOpacity onPress={() => setPreviewVisible(true)}>
            <Image
              source={{ uri: `data:${file.mimeType};base64,${file.data}` }}
              style={styles.image}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <ImagePreview
            visible={previewVisible}
            mimeType={file.mimeType}
            data={file.data}
            fileName={file.name}
            onClose={() => setPreviewVisible(false)}
          />
        </>
      )}

      {file && !isImage && (
        <View style={[styles.fileBox, { borderColor: theme.border }]}>
          <Text style={[styles.fileName, { color: theme.text, fontFamily: fonts.mono }]} numberOfLines={1}>
            {file.name}
          </Text>
          <Text style={[styles.fileSize, { color: theme.textMuted, fontFamily: fonts.mono }]}>
            {(file.size / 1024).toFixed(1)} KB
          </Text>
        </View>
      )}

      {text ? (
        <Text style={[styles.text, { color: theme.text, fontFamily: fonts.body }]}>
          {text}
        </Text>
      ) : null}

      <Text style={[styles.time, { color: theme.textMuted, fontFamily: fonts.mono }]}>
        {time}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 4,
    marginVertical: 2,
    marginHorizontal: 12,
  },
  sender: { fontSize: 12, marginBottom: 4 },
  text: { fontSize: 15, lineHeight: 20 },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  image: {
    width: 200,
    height: 200,
    borderRadius: 4,
    marginBottom: 4,
  },
  fileBox: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    marginBottom: 4,
  },
  fileName: { fontSize: 13 },
  fileSize: { fontSize: 11, marginTop: 2 },
});
