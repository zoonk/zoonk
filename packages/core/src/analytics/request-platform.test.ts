import { headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import { getRequestPlatform } from "./request-platform";

// Request headers only exist inside a Next.js request; tests hand in the ones a client would send.
vi.mock("next/headers", () => ({ headers: vi.fn() }));

function requestFrom(userAgent: string | null) {
  vi.mocked(headers).mockResolvedValueOnce(
    new Headers(userAgent === null ? {} : { "user-agent": userAgent }),
  );
}

const CLIENTS = [
  { platform: "ios", userAgent: "Zoonk/42 CFNetwork/3826.500.111 Darwin/25.0.0" },
  { platform: "android", userAgent: "okhttp/4.12.0" },
  {
    platform: "android",
    userAgent: "Dalvik/2.1.0 (Linux; U; Android 15; Pixel 9 Build/AP4A.250105.002)",
  },
  {
    platform: "web",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  },
  {
    platform: "web",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  },
  {
    platform: "web",
    userAgent:
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  },
  { platform: null, userAgent: "Stripe/1.0 (+https://stripe.com/docs/webhooks)" },
  { platform: null, userAgent: "curl/8.7.1" },
  { platform: null, userAgent: "node" },
  { platform: null, userAgent: null },
] as const;

describe(getRequestPlatform, () => {
  it.each(CLIENTS)("names $userAgent as $platform", async ({ platform, userAgent }) => {
    requestFrom(userAgent);
    await expect(getRequestPlatform()).resolves.toBe(platform);
  });

  it("is null where Next.js can't read the request", async () => {
    vi.mocked(headers).mockRejectedValueOnce(new Error("`headers` was called outside a request"));
    await expect(getRequestPlatform()).resolves.toBeNull();
  });
});
