import { decrypt, encrypt } from "./crypto";

const ENCRYPTED_PREFIX = "snip:encrypted-v2:";

export class StorageDecryptionError extends Error {}

function createStorage(area: "local" | "session") {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const result = await chrome.storage[area].get(key);
      const value: unknown = result[key];
      if (value === undefined) return undefined;

      try {
        if (typeof value !== "string" || !value.startsWith(ENCRYPTED_PREFIX)) {
          throw new Error("Expected encrypted storage value");
        }
        return JSON.parse(
          decrypt(value.slice(ENCRYPTED_PREFIX.length), `${area}:${key}`),
        ) as T;
      } catch (cause) {
        throw new StorageDecryptionError("저장된 데이터를 복호화하지 못했습니다.", { cause });
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      const ciphertext = encrypt(JSON.stringify(value), `${area}:${key}`);
      await chrome.storage[area].set({ [key]: ENCRYPTED_PREFIX + ciphertext });
    },

    async remove(key: string): Promise<void> {
      await chrome.storage[area].remove(key);
    },
  };
}

export const storage = createStorage("local");
export const sessionStorage = createStorage("session");
