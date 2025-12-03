import { type NextRequest, NextResponse } from "next/server";

const allowedOrigins = ["http://localhost:3000", "http://localhost:3001"];

export function proxy(request: NextRequest) {
  // Check the origin from the request
  const origin = request.headers.get("origin") ?? "";
  const isAllowedOrigin = allowedOrigins.includes(origin);

  // Handle simple requests
  const response = NextResponse.next();

  if (isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  return response;
}

export const config = {
  matcher: "/v1/(.*)",
};
