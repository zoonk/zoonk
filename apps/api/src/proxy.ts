import { isTrustedOrigin } from "@zoonk/utils/url";
import { type NextRequest, NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");

  // No origin = non-browser client (mobile, curl) - allowed
  if (!origin) {
    return NextResponse.next();
  }

  const isAllowed = isTrustedOrigin(origin);

  // Handle preflight (OPTIONS)
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      headers: {
        ...(isAllowed && { "Access-Control-Allow-Origin": origin }),
        ...corsHeaders,
      },
      status: 204,
    });
  }

  // Handle regular requests
  const response = NextResponse.next();

  if (isAllowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

export const config = {
  // API routes only - Better Auth handles /v1/auth CORS itself
  matcher: "/v1/:path*",
};
