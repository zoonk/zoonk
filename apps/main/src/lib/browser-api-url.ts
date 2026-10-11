import { API_URL } from "@zoonk/utils/url";

/** Vercel custom environments also report "preview" and need the protected API proxy. */
export function getBrowserApiUrl(): string {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" && globalThis.location !== undefined) {
    return globalThis.location.origin;
  }

  return API_URL;
}
