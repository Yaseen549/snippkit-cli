import Conf from 'conf';
import crypto from 'crypto';
import os from 'os';

// Store preferences with restricted local file permissions (0o600 = User read/write only)
export const config = new Conf({
  projectName: 'snippkit-cli',
  configFileMode: 0o600
});

// Derive a machine/user-specific 256-bit encryption key
function getDerivedKey() {
  let user = 'user';
  try {
    user = process.env.USERNAME || process.env.USER || os.userInfo()?.username || 'user';
  } catch(e) {
    user = process.env.USERNAME || process.env.USER || 'user';
  }
  let host = 'localhost';
  try {
    host = os.hostname() || process.env.COMPUTERNAME || 'localhost';
  } catch(e) {
    host = process.env.COMPUTERNAME || 'localhost';
  }
  const cleanUser = String(user).toLowerCase().trim();
  const cleanHost = String(host).toLowerCase().trim();
  const machineSecret = `${cleanUser}_${cleanHost}_SNIPPKIT_CLI_V2_VAULT_SECRET`;
  return crypto.pbkdf2Sync(machineSecret, 'snippkit_v2_salt_secure_vault', 100000, 32, 'sha256');
}

function encryptCredential(plaintext) {
  if (!plaintext) return null;
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return {
    iv: iv.toString('hex'),
    authTag,
    ciphertext: encrypted
  };
}

function decryptCredential(vaultObj) {
  if (!vaultObj || !vaultObj.iv || !vaultObj.authTag || !vaultObj.ciphertext) return '';
  try {
    const key = getDerivedKey();
    const iv = Buffer.from(vaultObj.iv, 'hex');
    const authTag = Buffer.from(vaultObj.authTag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(vaultObj.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return '';
  }
}

// Automatic Legacy Migration helper
function migrateLegacyKey() {
  const legacyKey = config.get('apiKey');
  if (legacyKey && typeof legacyKey === 'string' && legacyKey.trim()) {
    // 1. Encrypt and store legacy key in secure vault
    const vaultData = encryptCredential(legacyKey.trim());
    config.set('secureVault', vaultData);
    
    // 2. Remove plaintext key from conf
    config.delete('apiKey');
    return legacyKey.trim();
  }
  return null;
}

export const getApiKey = () => {
  // Check and run legacy migration if plaintext apiKey exists
  const migratedKey = migrateLegacyKey();
  if (migratedKey) return migratedKey;

  const vaultData = config.get('secureVault');
  return decryptCredential(vaultData);
};

export const setApiKey = (key) => {
  if (!key || !key.trim()) {
    deleteApiKey();
    return;
  }
  const cleanKey = key.trim();
  const vaultData = encryptCredential(cleanKey);
  config.set('secureVault', vaultData);
  
  // Ensure legacy plaintext apiKey key is deleted
  config.delete('apiKey');
};

export const deleteApiKey = () => {
  config.delete('secureVault');
  config.delete('apiKey');
};

export const clearConfig = () => {
  config.clear();
};

export const maskApiKey = (key) => {
  if (!key || key.length <= 8) return '********';
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
};