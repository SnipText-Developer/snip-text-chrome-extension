import { gcm } from "@noble/ciphers/aes.js";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/ciphers/utils.js";
import type { AuthTokenContext } from "./types";

// A fresh 256-bit key is injected by webpack for each build.
// Values bundled with an extension can be inspected by its users.
declare const __AUTH_TOKEN_ENCRYPTION_KEY_HEX__: string;

type TokenContext = AuthTokenContext;

const encodeContext = (context: TokenContext) =>
  new TextEncoder().encode(JSON.stringify([context.vendor, context.expiresAt]));

export function encryptAuthToken(token: string, context: TokenContext): string {
  const key = hexToBytes(__AUTH_TOKEN_ENCRYPTION_KEY_HEX__);
  const iv = randomBytes(12);
  const plaintext = new TextEncoder().encode(token);
  try {
    const ciphertext = gcm(key, iv, encodeContext(context)).encrypt(plaintext);
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

export function decryptAuthToken(token: string, context: TokenContext): string {
  const payload = JSON.parse(token);
  if (
    !payload ||
    payload.version !== 1 ||
    typeof payload.iv !== "string" ||
    !/^[0-9a-f]{24}$/.test(payload.iv) ||
    typeof payload.ciphertext !== "string" ||
    !/^(?:[0-9a-f]{2}){16,}$/.test(payload.ciphertext)
  )
    throw new Error("잘못된 토큰 암호문입니다.");
  const key = hexToBytes(__AUTH_TOKEN_ENCRYPTION_KEY_HEX__);
  let plaintext: Uint8Array | undefined;
  try {
    plaintext = gcm(
      key,
      hexToBytes(payload.iv),
      encodeContext(context),
    ).decrypt(hexToBytes(payload.ciphertext));
    return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  } finally {
    key.fill(0);
    plaintext?.fill(0);
  }
}
