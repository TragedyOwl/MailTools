import CryptoJS from 'crypto-js';

const DEVICE_KEY_STORAGE = 'sma-device-key';

/**
 * 获取设备级加密密钥：
 * 首次启动生成随机密钥并持久化到 LocalStorage，
 * 敏感凭据（邮箱密码 / API Key）使用该密钥经 PBKDF2 派生后 AES 加密存储。
 * 预留主密码能力：调用方可在派生时拼接用户主密码提升安全性。
 */
export const getDeviceKey = (): string => {
  let key = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (!key) {
    key = CryptoJS.lib.WordArray.random(256 / 8).toString(CryptoJS.enc.Hex);
    localStorage.setItem(DEVICE_KEY_STORAGE, key);
  }
  return key;
};

const deriveKey = (masterKey: string, salt: CryptoJS.lib.WordArray): CryptoJS.lib.WordArray =>
  CryptoJS.PBKDF2(masterKey, salt, { keySize: 256 / 32, iterations: 10000 });

/** AES 加密（PBKDF2 派生密钥 + 随机 IV），输出格式：salt:iv:cipher（Hex） */
export const encryptCredential = (text: string, masterKey: string = getDeviceKey()): string => {
  const salt = CryptoJS.lib.WordArray.random(128 / 8);
  const iv = CryptoJS.lib.WordArray.random(128 / 8);
  const key = deriveKey(masterKey, salt);
  const encrypted = CryptoJS.AES.encrypt(text, key, { iv });
  return `${salt.toString(CryptoJS.enc.Hex)}:${iv.toString(CryptoJS.enc.Hex)}:${encrypted.ciphertext.toString(CryptoJS.enc.Hex)}`;
};

/** AES 解密，输入格式：salt:iv:cipher（Hex） */
export const decryptCredential = (cipher: string, masterKey: string = getDeviceKey()): string => {
  try {
    const [saltHex, ivHex, cipherHex] = cipher.split(':');
    if (!saltHex || !ivHex || !cipherHex) return '';
    const salt = CryptoJS.enc.Hex.parse(saltHex);
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const key = deriveKey(masterKey, salt);
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Hex.parse(cipherHex),
    });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, { iv });
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    return '';
  }
};

/** 日志脱敏：长文本截断 */
export const maskSensitive = (text: string, maxLength = 50): string =>
  text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
