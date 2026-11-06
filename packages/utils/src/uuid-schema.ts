import { z } from "zod";

/**
 * Reads a UUID in any case as lowercase, the way the database returns it, so ids a client
 * capitalized still match stored ones compared with `===`.
 */
export function uuidSchema() {
  // oxlint-disable-next-line eslint/no-restricted-properties -- the one place ids are declared
  return z.uuid().toLowerCase();
}
