import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";
import { type AnalyticsPlatform } from "./shared-properties";

/** URLSession identifies the Apple app with a CFNetwork user agent. */
const APPLE_APP = /\bCFNetwork\//u;

/** How the user agents of Android's own HTTP clients start: OkHttp and HttpURLConnection. */
const ANDROID_APPS = ["okhttp/", "Dalvik/"];

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

/** Returns null outside a recognized client request. Workflow steps must carry the originating platform. */
export async function getRequestPlatform(): Promise<AnalyticsPlatform | null> {
  const { data: requestHeaders } = await safeAsync(() => headers());
  return toPlatform(requestHeaders?.get("user-agent") ?? null);
}
