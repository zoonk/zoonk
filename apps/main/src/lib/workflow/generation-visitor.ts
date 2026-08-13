import { isUuid } from "@zoonk/utils/uuid";

const GENERATION_VISITOR_STORAGE_KEY = "zoonk:generation-visitor:v1";

/**
 * Persists a random browser identity for guest generation quotas. Storage can
 * be unavailable in privacy modes, so callers fall back to the API's hashed
 * request fingerprint by omitting the visitor header in that case.
 */
export function getGenerationVisitorId(): string | null {
  try {
    const storedVisitorId = globalThis.localStorage.getItem(GENERATION_VISITOR_STORAGE_KEY);

    if (storedVisitorId && isUuid(storedVisitorId)) {
      return storedVisitorId;
    }

    const visitorId = globalThis.crypto.randomUUID();
    globalThis.localStorage.setItem(GENERATION_VISITOR_STORAGE_KEY, visitorId);
    return visitorId;
  } catch {
    return null;
  }
}
