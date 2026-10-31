import { getRequestCountry } from "@zoonk/utils/locale-request";
import { COUNTRY_COOKIE } from "@zoonk/utils/usage-data";
import { type NextRequest, NextResponse } from "next/server";

const HOUR_SECONDS = 60 * 60;

/**
 * An hour, so someone who travels or turns on a VPN is asked once they're where the law needs it,
 * without the browser asking on every page.
 */
export function GET(request: NextRequest): NextResponse {
  const response = new NextResponse(null, {
    headers: { "Cache-Control": "private, no-store" },
    status: 204,
  });

  response.cookies.set(COUNTRY_COOKIE, getRequestCountry(request.headers), {
    maxAge: HOUR_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });

  return response;
}
