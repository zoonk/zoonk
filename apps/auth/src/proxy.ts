import { trustedOrigins } from "@zoonk/auth";
import { isAllowedOrigin } from "@zoonk/utils/cors";
import { type NextRequest, NextResponse } from "next/server";

const corsOptions = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const isAllowed = isAllowedOrigin(origin, trustedOrigins);

  // Handle preflighted requests
  const isPreflight = request.method === "OPTIONS";

  if (isPreflight) {
    const preflightHeaders = {
      ...(isAllowed && {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": origin,
      }),
      ...corsOptions,
    };
    return NextResponse.json({}, { headers: preflightHeaders });
  }

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
