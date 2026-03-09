// Mobile crypto adapter — verifies dissolve-core works on React Native
// react-native-quick-crypto provides WebCrypto polyfill for RN
import 'react-native-quick-crypto';

// Re-export dissolve-core crypto functions
// If these imports resolve cleanly, crypto works on React Native
export {
  e2eeEncrypt,
  e2eeDecrypt,
  signObject,
  verifyObject,
  generateGroupKey,
  generateGroupId,
  groupEncrypt,
  groupDecrypt,
  wrapGroupKey,
  unwrapGroupKey,
  encryptPrivateData,
  decryptPrivateData,
  b64uFromBytes,
  bytesFromB64u,
  randomCap,
  randomId,
} from 'dissolve-core/crypto';
