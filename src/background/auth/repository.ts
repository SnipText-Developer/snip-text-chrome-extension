import { sendMessage } from "../../common/message-bus";
import { encryptAuthToken, decryptAuthToken } from "./token-crypto";
import type { AuthToken, AuthVendor } from "./types";

type StoredToken = AuthToken;
const tokens = new Map<AuthVendor, StoredToken>();
const expirations = new Map<AuthVendor, number>();
const timers = new Map<AuthVendor, ReturnType<typeof setTimeout>>();

function notifyAuthChanged() {
  void sendMessage({
    src: "BACKGROUND",
    dst: "PAGE",
    method: "NOTIFY",
    path: "/auth/status",
    data: {},
  });
}

const remove = (vendor: AuthVendor): boolean => {
  const timer = timers.get(vendor);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(vendor);
  expirations.delete(vendor);
  return tokens.delete(vendor);
};

const deleteOne = (vendor: AuthVendor): boolean => {
  const deleted = remove(vendor);
  if (deleted) notifyAuthChanged();
  return deleted;
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
  remove(value.vendor);
  tokens.set(value.vendor, { vendor: value.vendor, token });
  expirations.set(value.vendor, expiresAt);
  timers.set(
    value.vendor,
    setTimeout(() => deleteOne(value.vendor), expiresAt - Date.now()),
  );
  notifyAuthChanged();
  return { ...value };
};

const readLatest = (): AuthToken | null => {
  for (const vendor of [...tokens.keys()].reverse()) {
    const token = read(vendor);
    if (token) return token;
  }
  return null;
};

export const repository = { read, readLatest, update: write, deleteOne };
