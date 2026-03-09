import { Modal, View, Image, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { useContext } from 'react';
import { ThemeContext } from '../../app/_layout';
import { fonts } from '../theme/fonts';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  mimeType: string;
  data: string;
  fileName?: string;
  onClose: () => void;
}

export function ImagePreview({ visible, mimeType, data, fileName, onClose }: Props) {
  const theme = useContext(ThemeContext);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.95)' }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={[styles.closeText, { color: theme.text, fontFamily: fonts.bodySemiBold }]}>
            Close
          </Text>
        </TouchableOpacity>

        <Image
          source={{ uri: `data:${mimeType};base64,${data}` }}
          style={styles.image}
          resizeMode="contain"
        />

        {fileName && (
          <Text style={[styles.fileName, { color: theme.textMuted, fontFamily: fonts.mono }]}>
            {fileName}
          </Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  closeText: { fontSize: 16 },
  image: {
    width: width - 32,
    height: height * 0.7,
  },
  fileName: {
    fontSize: 12,
    marginTop: 12,
  },
});
