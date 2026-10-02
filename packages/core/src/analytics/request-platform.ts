import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";
import { type AnalyticsPlatform } from "./shared-properties";

/**
 * The Apple app calls the API through URLSession, whose user agent is
 * `<app>/<build> CFNetwork/<version> Darwin/<version>`; no browser sends CFNetwork.
 */
const APPLE_APP = /\bCFNetwork\//u;

/** How the user agents of Android's own HTTP clients start: OkHttp and HttpURLConnection. */
const ANDROID_APPS = ["okhttp/", "Dalvik/"];

/** Every browser sends a Mozilla-style user agent, on phones too: that's the web client. */
const BROWSER = "Mozilla/";

function toPlatform(userAgent: string | null): AnalyticsPlatform | null {
  if (!userAgent) {
    return null;
  }

  if (APPLE_APP.test(userAgent)) {
    return "ios";
  }

  if (ANDROID_APPS.some((prefix) => userAgent.startsWith(prefix))) {
    return "android";
  }

  return userAgent.startsWith(BROWSER) ? "web" : null;
}

/**
 * The client that sent the request being handled, from its user agent: `web` for browsers (Main's
 * pages and Server Actions, and its calls to the API), `ios` and `android` for the native apps.
 * Null for any other caller (scripts, webhooks, cron) and where Next.js can't read headers, such as
 * outside a request or in `after()` work scheduled during a render. A workflow step runs in the
 * workflow runtime's request, not the learner's, so runs carry the platform read when they started.
 */
export async function getRequestPlatform(): Promise<AnalyticsPlatform | null> {
  const { data: requestHeaders } = await safeAsync(() => headers());
  return toPlatform(requestHeaders?.get("user-agent") ?? null);
}
