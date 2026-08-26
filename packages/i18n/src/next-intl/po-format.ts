import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Gives every next-intl consumer the same absolute codec path because custom
 * codec paths are otherwise resolved relative to each app's project root.
 */
export const NEXT_INTL_PO_FORMAT = {
  codec: require.resolve("@eloqnt/format-po"),
  extension: ".po",
} as const;
