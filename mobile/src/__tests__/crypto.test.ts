import {
  generateGroupKey,
  groupEncrypt,
  groupDecrypt,
} from '../adapters/crypto';

describe('dissolve-core crypto on React Native', () => {
  it('round-trips group encrypt/decrypt', async () => {
    const key = await generateGroupKey();
    const plaintext = 'hello from mobile';
    const encrypted = await groupEncrypt(plaintext, key);
    const decrypted = await groupDecrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });
});
