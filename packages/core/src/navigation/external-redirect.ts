import { redirect } from "next/navigation";

/**
 * Redirects to an external URL.
 *
 * Next.js typed routes do not allow arbitrary external URLs, so this helper
 * centralizes the necessary type assertion with documentation.
 */
export function externalRedirect(url: string): never {
  // oxlint-disable-next-line typescript/no-unnecessary-type-assertion typescript/no-unsafe-type-assertion -- standalone package types cannot see the consuming app's generated Route union
  return redirect(url as never);
}
