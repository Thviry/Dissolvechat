import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useContext, useState, useRef, useEffect } from 'react';
import { AuthContext, ThemeContext } from './_layout';
import { fonts } from '../src/theme/fonts';
import { parseQrPayload, performLinkFlow } from '../src/adapters/linking';
import { appStorage } from '../src/adapters/storage';

export default function LinkDeviceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sid?: string; pk?: string }>();
  const auth = useContext(AuthContext)!;
  const theme = useContext(ThemeContext);
  const [permission, requestPermission] = useCameraPermissions();

  const [status, setStatus] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [keyfileJson, setKeyfileJson] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scannedRef = useRef(false);

  // Handle deep link params (dissolve://link?sid=...&pk=...)
  useEffect(() => {
    if (params.sid && params.pk && !scannedRef.current) {
      scannedRef.current = true;
      const payload = { sid: params.sid, pk: params.pk };
      performLinkFlow(payload, setStatus)
        .then((result) => {
          setKeyfileJson(result);
          setStatus('Enter your passphrase to complete setup.');
        })
        .catch((err: any) => {
          Alert.alert('Link Failed', err.message || 'Failed to link device');
          scannedRef.current = false;
          setStatus(null);
        });
    }
  }, [params.sid, params.pk]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;

    const payload = parseQrPayload(data);
    if (!payload) {
      Alert.alert('Invalid QR Code', 'This QR code is not a valid DissolveChat link.');
      scannedRef.current = false;
      return;
    }

    try {
      const result = await performLinkFlow(payload, setStatus);
      setKeyfileJson(result);
      setStatus('Enter your passphrase to complete setup.');
    } catch (err: any) {
      Alert.alert('Link Failed', err.message || 'Failed to link device');
      scannedRef.current = false;
      setStatus(null);
    }
  };

  const handleComplete = async () => {
    if (!keyfileJson || !passphrase) return;
    setLoading(true);
    try {
      const { userId, importedContacts, importedGroups } = await auth.login(keyfileJson, passphrase);

      if (importedContacts.length > 0) {
        await appStorage.setJson(`contacts:${userId}`, importedContacts);
      }
      if (importedGroups.length > 0) {
        await appStorage.setJson(`groups:${userId}`, importedGroups);
      }

      router.replace('/(tabs)/chats');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to decrypt identity. Check your passphrase.');
      setLoading(false);
    }
  };

  // Passphrase entry step
  if (keyfileJson) {
    return (
      <View style={[styles.container, { backgroundColor: theme.void }]}>
        <Text style={[styles.title, { color: theme.accent, fontFamily: fonts.heading }]}>
          Device Linked
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: fonts.body }]}>
          Enter your passphrase to unlock your identity on this device.
        </Text>

        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, fontFamily: fonts.body }]}
          placeholder="Enter passphrase"
          placeholderTextColor={theme.textMuted}
          value={passphrase}
          onChangeText={setPassphrase}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent, opacity: loading ? 0.5 : 1 }]}
          onPress={handleComplete}
          disabled={loading}
        >
          <Text style={[styles.buttonText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
            {loading ? 'Decrypting...' : 'Complete Setup'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Camera permission request
  if (!permission?.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.void }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: theme.textMuted, fontFamily: fonts.body }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: theme.text, fontFamily: fonts.heading }]}>
          Link Device
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: fonts.body }]}>
          Camera access is needed to scan the QR code from your desktop.
        </Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={requestPermission}
        >
          <Text style={[styles.buttonText, { color: theme.void, fontFamily: fonts.bodySemiBold }]}>
            Allow Camera Access
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // QR Scanner
  return (
    <View style={[styles.container, { backgroundColor: theme.void }]}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={[styles.back, { color: theme.textMuted, fontFamily: fonts.body }]}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: theme.text, fontFamily: fonts.heading }]}>
        Scan QR Code
      </Text>
      <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: fonts.body }]}>
        Point your camera at the QR code on your desktop.
      </Text>

      {status ? (
        <View style={styles.statusBox}>
          <Text style={[styles.statusText, { color: theme.accent, fontFamily: fonts.mono }]}>
            {status}
          </Text>
        </View>
      ) : (
        <View style={styles.cameraWrapper}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <View style={[styles.scanOverlay, { borderColor: theme.accent }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  back: { fontSize: 16, marginBottom: 24 },
  title: { fontSize: 24, marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: { padding: 16, borderRadius: 4, alignItems: 'center' },
  buttonText: { fontSize: 16 },
  cameraWrapper: {
    flex: 1,
    maxHeight: 320,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: { flex: 1 },
  scanOverlay: {
    position: 'absolute',
    top: '25%',
    left: '15%',
    width: '70%',
    height: '50%',
    borderWidth: 2,
    borderRadius: 4,
  },
  statusBox: {
    flex: 1,
    maxHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: { fontSize: 15, textAlign: 'center' },
});
