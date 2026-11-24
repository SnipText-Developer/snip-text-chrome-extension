import { gcm } from "@noble/ciphers/aes.js";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/ciphers/utils.js";

declare const __STORAGE_ENCRYPTION_KEY_HEX__: string;

export function encrypt(value: string, context: string): string {
  const key = hexToBytes(__STORAGE_ENCRYPTION_KEY_HEX__);
  const iv = randomBytes(12);
  const plaintext = new TextEncoder().encode(value);
  try {
    const ciphertext = gcm(key, iv, new TextEncoder().encode(context)).encrypt(plaintext);
    // GCM includes the authentication tag in ciphertext.
    return JSON.stringify({
      version: 1,
      iv: bytesToHex(iv),
      ciphertext: bytesToHex(ciphertext),
    });
  } finally {
    key.fill(0);
    plaintext.fill(0);
  }
}

export function decrypt(value: string, context: string): string {
  const payload = JSON.parse(value);
  if (
    !payload ||
    payload.version !== 1 ||
    typeof payload.iv !== "string" ||
    !/^[0-9a-f]{24}$/.test(payload.iv) ||
    typeof payload.ciphertext !== "string" ||
    payload.ciphertext.length < 32 ||
    payload.ciphertext.length % 2 !== 0 ||
    /[^0-9a-f]/.test(payload.ciphertext)
  ) {
    throw new Error("잘못된 암호문입니다.");
  }
  const key = hexToBytes(__STORAGE_ENCRYPTION_KEY_HEX__);
  let plaintext: Uint8Array | undefined;
  try {
    plaintext = gcm(
      key,
      hexToBytes(payload.iv),
      new TextEncoder().encode(context),
    ).decrypt(hexToBytes(payload.ciphertext));
    return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  } finally {
    key.fill(0);
    plaintext?.fill(0);
  }
}
