import { readRedirectToParam } from "../../_utils/auth-redirect";

/** The page is prerendered once per language, so only the browser knows the address it opened at. */
export function readPageRedirectTo(): string | null {
  return readRedirectToParam(new URLSearchParams(globalThis.location.search));
}
