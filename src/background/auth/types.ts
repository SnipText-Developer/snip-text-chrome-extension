export type AuthVendor = "GOOGLE" | "NAVER";

export interface AuthToken {
  vendor: AuthVendor;
  token: string;
}

export interface AuthTokenContext {
  vendor: AuthVendor;
  expiresAt: number;
}
