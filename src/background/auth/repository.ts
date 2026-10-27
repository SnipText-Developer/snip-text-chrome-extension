import { encryptAuthToken, decryptAuthToken } from "./token-crypto";
import type { AuthToken, AuthVendor } from "./types";

type StoredToken = AuthToken;
const tokens = new Map<AuthVendor, StoredToken>();
const expirations = new Map<AuthVendor, number>();
const timers = new Map<AuthVendor, ReturnType<typeof setTimeout>>();

const deleteOne = (vendor: AuthVendor): boolean => {
  const timer = timers.get(vendor);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(vendor);
  expirations.delete(vendor);
  return tokens.delete(vendor);
};

const read = (vendor: AuthVendor): AuthToken | null => {
  const stored = tokens.get(vendor);
  const expiresAt = expirations.get(vendor);
  if (!stored) return null;
  if (expiresAt === undefined || expiresAt <= Date.now()) {
    deleteOne(vendor);
    return null;
  }
  try {
    return {
      vendor,
      token: decryptAuthToken(stored.token, { vendor, expiresAt }),
    };
  } catch {
    deleteOne(vendor);
    return null;
  }
};

const write = (value: AuthToken, expiresAt: number): AuthToken => {
  const token = encryptAuthToken(value.token, {
    vendor: value.vendor,
    expiresAt,
  });
  deleteOne(value.vendor);
  tokens.set(value.vendor, { vendor: value.vendor, token });
  expirations.set(value.vendor, expiresAt);
  timers.set(
    value.vendor,
    setTimeout(() => deleteOne(value.vendor), expiresAt - Date.now()),
  );
  return { ...value };
};

const create = (value: AuthToken, expiresAt: number): AuthToken | null => {
  if (read(value.vendor)) return null;
  return write(value, expiresAt);
};

const update = (value: AuthToken, expiresAt: number): AuthToken | null => {
  if (!read(value.vendor)) return null;
  return write(value, expiresAt);
};

export const repository = { create, read, update, deleteOne };
