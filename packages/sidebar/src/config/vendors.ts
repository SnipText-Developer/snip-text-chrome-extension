export const vendors = [
  { id: "GOOGLE", name: "Google", mailName: "Gmail", mark: "G", hostname: "mail.google.com" },
  { id: "NAVER", name: "Naver", mailName: "네이버 메일", mark: "N", hostname: "mail.naver.com" },
] as const;

export type Vendor = typeof vendors[number];
export type VendorName = Vendor["id"];

export function isVendorName(value: unknown): value is VendorName {
  return vendors.some((vendor) => vendor.id === value);
}

export function getVendorByUrl(address: string | undefined): Vendor | null {
  if (!address) return null;
  try {
    const url = new URL(address);
    if (url.protocol !== "https:") return null;
    return vendors.find((vendor) => vendor.hostname === url.hostname) ?? null;
  } catch {
    return null;
  }
}
