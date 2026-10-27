import { repository } from "./repository";
import type { AuthToken, AuthVendor } from "./types";

export class AuthError extends Error {}

const MAX_AGE_MS = 5 * 60 * 1000;

function parseVendor(value: unknown): AuthVendor {
  if (value !== "GOOGLE" && value !== "NAVER") {
    throw new AuthError("지원하지 않는 인증 vendor입니다.");
  }
  return value;
}

function parseToken(input: unknown): { value: AuthToken; expiresAt: number } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AuthError("인증 토큰 정보를 입력해주세요.");
  }
  const data = input as Record<string, unknown>;
  const vendor = parseVendor(data.vendor);
  if (typeof data.token !== "string" || !data.token.trim()) {
    throw new AuthError("인증 토큰은 비어 있지 않은 문자열이어야 합니다.");
  }
  const now = Date.now();
  if (
    data.expiresAt !== undefined &&
    (typeof data.expiresAt !== "number" ||
      !Number.isFinite(data.expiresAt) ||
      data.expiresAt <= now)
  )
    throw new AuthError("토큰 만료 시각은 현재보다 미래여야 합니다.");
  return {
    value: { vendor, token: data.token },
    expiresAt: Math.min(
      (data.expiresAt as number) ?? now + MAX_AGE_MS,
      now + MAX_AGE_MS,
    ),
  };
}

const create = (input: unknown) => {
  const { value, expiresAt } = parseToken(input);
  const result = repository.create(value, expiresAt);
  if (!result) throw new AuthError("이미 등록된 인증 토큰입니다.");
  return result;
};

const read = (vendor: unknown) => repository.read(parseVendor(vendor));
const update = (input: unknown) => {
  const { value, expiresAt } = parseToken(input);
  return repository.update(value, expiresAt);
};
const deleteOne = (vendor: unknown) =>
  repository.deleteOne(parseVendor(vendor));

export const service = { create, read, update, deleteOne };
