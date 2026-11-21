import { createHash } from "node:crypto";

const UUID_HEX_DIGITS = 32;
const UUID_GROUPS = /^(?<time>.{8})(?<mid>.{4})(?<high>.{4})(?<clock>.{4})(?<node>.{12})$/u;

export function toUsageClaimTarget(key: string): string {
  return createHash("sha256")
    .update(key)
    .digest("hex")
    .slice(0, UUID_HEX_DIGITS)
    .replace(UUID_GROUPS, "$<time>-$<mid>-$<high>-$<clock>-$<node>");
}
