import { describe, it, expect, beforeEach } from 'vitest';
import { getApiKey, setApiKey, deleteApiKey, maskApiKey, config } from '../src/lib/config.js';

describe('Secure Credential Storage & Migration', () => {
  beforeEach(() => {
    config.clear();
  });

  it('masks API key securely without exposing plaintext', () => {
    expect(maskApiKey('sk_live_1234567890abcdef')).toBe('sk_live...cdef');
    expect(maskApiKey('short')).toBe('********');
    expect(maskApiKey('')).toBe('********');
  });

  it('sets and retrieves encrypted API key using setApiKey and getApiKey', () => {
    const fakeKey = 'sk_test_FAKE_KEY_FOR_SECURITY_TEST_12345';
    setApiKey(fakeKey);

    // Verify key retrieval succeeds
    expect(getApiKey()).toBe(fakeKey);

    // Verify plaintext 'apiKey' is NOT stored in conf
    expect(config.get('apiKey')).toBeUndefined();

    // Verify encrypted vault payload exists in conf
    const vault = config.get('secureVault');
    expect(vault).not.toBeNull();
    expect(vault.ciphertext).toBeDefined();
    expect(vault.ciphertext).not.toBe(fakeKey); // Must not be stored as plaintext
  });

  it('deletes API key from secure vault and config', () => {
    setApiKey('sk_test_KEY_TO_DELETE');
    deleteApiKey();

    expect(getApiKey()).toBe('');
    expect(config.get('secureVault')).toBeFalsy();
    expect(config.get('apiKey')).toBeUndefined();
  });

  it('automatically migrates legacy plaintext apiKey to secureVault and cleans up conf', () => {
    const legacyKey = 'sk_test_LEGACY_PLAINTEXT_KEY_99999';
    
    // Simulate legacy v1/v2 plaintext key in conf
    config.set('apiKey', legacyKey);
    expect(config.get('apiKey')).toBe(legacyKey);

    // Calling getApiKey should trigger automatic migration
    const retrievedKey = getApiKey();
    expect(retrievedKey).toBe(legacyKey);

    // Verify plaintext 'apiKey' entry was deleted from conf
    expect(config.get('apiKey')).toBeUndefined();

    // Verify encrypted vault now holds the credential
    const vault = config.get('secureVault');
    expect(vault).not.toBeNull();
    expect(vault.ciphertext).not.toBe(legacyKey);
  });
});
