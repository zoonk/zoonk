import { redirect } from "next/navigation";

/**
 * Redirect to an external URL.
 *
 * Next.js typed routes don't allow arbitrary external URLs, so we use this
 * helper to centralize the necessary type assertion with documentation.
 */
export function externalRedirect(url: string): never {
  // oxlint-disable-next-line typescript/no-unnecessary-type-assertion typescript/no-unsafe-type-assertion -- standalone package types cannot see the consuming app's generated Route union
  return redirect(url as never);
}
