import { getApiDeploymentHeaders } from "@zoonk/core/security/api-deployment";
import { API_URL } from "@zoonk/utils/url";
import { type NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Keeps user bearer auth separate from platform auth. Ambient browser cookies
 * must not become API credentials merely because the browser now calls Main.
 */
export async function proxyApiRequest(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  if (process.env.VERCEL_ENV !== "preview" || path === "/v1/auth" || path.startsWith("/v1/auth/")) {
    return new NextResponse(null, { status: 404 });
  }

  if (
    !SAFE_METHODS.has(request.method) &&
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
    return new NextResponse(null, { status: 403 });
  }

  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("x-vercel-oidc-token");
  headers.delete("x-vercel-protection-bypass");
  headers.delete("x-vercel-set-bypass-cookie");
  headers.delete("x-vercel-trusted-oidc-idp-token");

  const deploymentHeaders = await getApiDeploymentHeaders();

  Object.entries(deploymentHeaders).forEach(([name, value]) => headers.set(name, value));

  return NextResponse.rewrite(new URL(path + request.nextUrl.search, API_URL), {
    request: { headers },
  });
}
