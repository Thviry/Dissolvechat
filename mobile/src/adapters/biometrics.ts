import * as LocalAuthentication from 'expo-local-authentication';
import { secureStorage } from './storage';

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return compatible && enrolled;
}

export async function getBiometricType(): Promise<string | null> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Touch ID';
  }
  return null;
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock DissolveChat',
    cancelLabel: 'Use Passphrase',
    disableDeviceFallback: true,
  });
  return result.success;
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await secureStorage.get('biometric_enabled');
  return val === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await secureStorage.set('biometric_enabled', 'true');
  } else {
    await secureStorage.remove('biometric_enabled');
  }
}
