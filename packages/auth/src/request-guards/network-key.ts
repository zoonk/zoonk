import { createHash } from "node:crypto";

const JA4_DIGEST_HEADER = "x-vercel-ja4-digest";
const KEY_DIGEST_LENGTH = 32;
const NETWORK_KEY_PREFIX = "network:";
const IPV6_GROUPS = 8;

/** Providers hand one IPv6 /64 to a single home or phone, so its first four groups are one client. */
const IPV6_CLIENT_GROUPS = 4;

const IPV4_MAPPED_IPV6 = /^::ffff:(?<ipv4>\d{1,3}(?:\.\d{1,3}){3})$/u;

/** Selects the original client address the way Vercel reports it, before any proxy hops. */
function getClientAddress(requestHeaders: Headers): string {
  const forwardedAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    requestHeaders.get("x-vercel-forwarded-for") ??
    forwardedAddress ??
    requestHeaders.get("x-real-ip") ??
    "unknown"
  );
}

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, KEY_DIGEST_LENGTH);
}

/** Writes an IPv6 address out in full, one group per entry, without leading zeros. */
function expandIPv6(address: string): string[] {
  const [head = "", tail] = address.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const missing = tail === undefined ? 0 : IPV6_GROUPS - headGroups.length - tailGroups.length;

  return [...headGroups, ...Array.from({ length: missing }, () => "0"), ...tailGroups].map(
    (group) => group.replace(/^0+(?=.)/u, ""),
  );
}

/**
 * The part of an address that belongs to one client: the whole IPv4 address, or an IPv6
 * address's /64, since one client can pick any address inside its /64 at will.
 */
function getClientAddressGroup(address: string): string {
  const normalized = address.trim().toLowerCase().split("%")[0] ?? "";
  const mappedIPv4 = IPV4_MAPPED_IPV6.exec(normalized)?.groups?.ipv4;

  if (mappedIPv4) {
    return mappedIPv4;
  }

  if (!normalized.includes(":")) {
    return normalized;
  }

  return `${expandIPv6(normalized).slice(0, IPV6_CLIENT_GROUPS).join(":")}::/64`;
}

/**
 * Identifies a visitor by network address and TLS fingerprint (JA4) together. Carrier NAT puts
 * thousands of people behind one address and one browser build shares a fingerprint, so only the
 * pair is specific enough for guest caps. The key is hashed so raw addresses are never stored.
 */
export function getNetworkKey(requestHeaders: Headers): string {
  const fingerprint = requestHeaders.get(JA4_DIGEST_HEADER) ?? "unknown";

  return `${NETWORK_KEY_PREFIX}${hashKey(`${getClientAddress(requestHeaders)}\n${fingerprint}`)}`;
}

/** Whether a rate-limit key is a network key, which also counts against a per-address ceiling. */
export function isNetworkKey(key: string): boolean {
  return key.startsWith(NETWORK_KEY_PREFIX);
}

/**
 * Identifies a visitor by network address alone (an IPv6 address by its /64). A client can change
 * its TLS fingerprint at will, so this key backs the network key with a higher ceiling that
 * rotating fingerprints can't reset. Hashed like the network key.
 */
export function getAddressKey(requestHeaders: Headers): string {
  return `address:${hashKey(getClientAddressGroup(getClientAddress(requestHeaders)))}`;
}
