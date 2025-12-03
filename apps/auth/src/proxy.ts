import { trustedOrigins } from "@zoonk/auth";
import { isAllowedOrigin } from "@zoonk/utils/cors";
import { type NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const isAllowed = isAllowedOrigin(origin, trustedOrigins);

  const response = NextResponse.next();

  if (isAllowed) {
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  return response;
}

export const config = {
  matcher: "/v1/(.*)",
};
