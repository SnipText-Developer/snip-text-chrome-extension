import definitions from "./vendors.json";

export type VendorName = keyof typeof definitions;
export const vendors = Object.entries(definitions).map(([id, config]) => ({
  id: id as VendorName,
  ...config,
}));
export type Vendor = typeof vendors[number];

export function isVendorName(value: unknown): value is VendorName {
  return typeof value === "string" && Object.hasOwn(definitions, value);
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

export function isComposeUrl(vendor: VendorName, address: string | undefined): boolean {
  if (getVendorByUrl(address)?.id !== vendor) return false;
  const path = definitions[vendor].composePath;
  if (!path) return true;
  const { pathname } = new URL(address!);
  return pathname === path || pathname.startsWith(path + "/");
}
