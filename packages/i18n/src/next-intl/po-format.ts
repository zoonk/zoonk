import { fileURLToPath } from "node:url";

/**
 * Gives every next-intl consumer the same absolute codec path because custom
 * codec paths are otherwise resolved relative to each app's project root.
 */
export const NEXT_INTL_PO_FORMAT = {
  codec: fileURLToPath(new URL("po-codec.ts", import.meta.url)),
  extension: ".po",
} as const;
