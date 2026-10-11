import "server-only";
import { getVercelOidcToken } from "@vercel/oidc";

/** Custom staging environments also have VERCEL_ENV=preview. Production stays public. */
export async function getApiDeploymentHeaders(): Promise<Record<string, string>> {
  if (process.env.VERCEL_ENV !== "preview") {
    return {};
  }

  const token = await getVercelOidcToken();

  if (!token) {
    throw new Error("Missing Vercel OIDC token for protected API access");
  }

  return { "x-vercel-trusted-oidc-idp-token": token };
}
