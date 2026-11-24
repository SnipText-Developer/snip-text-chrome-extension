import { sendMessage } from "../../common/message-bus";
import { sessionStorage, StorageDecryptionError } from "../common/storage";
import type { AuthToken, AuthVendor } from "./types";

const STORAGE_KEY = "snip.auth.tokens";
type StoredToken = AuthToken & { expiresAt: number };

let timer: ReturnType<typeof setTimeout> | undefined;
let pending: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.catch(() => {});
  return result;
}

function notifyAuthChanged() {
  void sendMessage({
    src: "BACKGROUND",
    dst: "PAGE",
    method: "NOTIFY",
    path: "/auth/status",
    data: {},
  });
}

function scheduleExpiration(tokens: StoredToken[]) {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  if (tokens.length === 0) return;

  const nextExpiry = Math.min(...tokens.map(({ expiresAt }) => expiresAt));
  const delay = Math.min(Math.max(0, nextExpiry - Date.now()), 2_147_483_647);
  timer = setTimeout(() => {
    void enqueue(loadActiveTokens).catch(() => {});
  }, delay);
}

async function save(tokens: StoredToken[]) {
  if (tokens.length) await sessionStorage.set(STORAGE_KEY, tokens);
  else await sessionStorage.remove(STORAGE_KEY);
  scheduleExpiration(tokens);
  notifyAuthChanged();
}

async function loadTokens(): Promise<StoredToken[]> {
  try {
    return (await sessionStorage.get<StoredToken[]>(STORAGE_KEY)) ?? [];
  } catch (error) {
    if (!(error instanceof StorageDecryptionError)) throw error;
    await save([]);
    return [];
  }
}

async function loadActiveTokens(): Promise<StoredToken[]> {
  const tokens = await loadTokens();
  const now = Date.now();
  const active = tokens.filter(({ expiresAt }) => expiresAt > now);
  if (active.length !== tokens.length) await save(active);
  else scheduleExpiration(active);
  return active;
}

const read = (vendor: AuthVendor): Promise<AuthToken | null> =>
  enqueue(async () => {
    const stored = (await loadActiveTokens()).find((token) => token.vendor === vendor);
    return stored ? { vendor: stored.vendor, token: stored.token } : null;
  });

const readLatest = (): Promise<AuthToken | null> =>
  enqueue(async () => {
    const stored = (await loadActiveTokens()).at(-1);
    return stored ? { vendor: stored.vendor, token: stored.token } : null;
  });

const write = (value: AuthToken, expiresAt: number): Promise<AuthToken> =>
  enqueue(async () => {
    const tokens = (await loadActiveTokens()).filter(({ vendor }) => vendor !== value.vendor);
    await save([...tokens, { ...value, expiresAt }]);
    return { ...value };
  });

const deleteOne = (vendor: AuthVendor): Promise<boolean> =>
  enqueue(async () => {
    const tokens = await loadTokens();
    const remaining = tokens.filter((token) => token.vendor !== vendor);
    if (remaining.length === tokens.length) return false;
    await save(remaining);
    return true;
  });

const deleteAll = (): Promise<void> =>
  enqueue(async () => {
    if ((await loadTokens()).length) await save([]);
  });

export const repository = { read, readLatest, update: write, deleteOne, deleteAll };
