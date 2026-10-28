import type { VendorName } from "../../config/vendors";

export type AuthVendor = VendorName;

export interface AuthToken {
  vendor: AuthVendor;
  token: string;
}

export interface AuthTokenContext {
  vendor: AuthVendor;
  expiresAt: number;
}
