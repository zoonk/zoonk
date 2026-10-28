import { type APIResponse, type BrowserContext } from "@playwright/test";
import { ONE_TIME_TOKEN_LOGIN_STATE_COOKIE } from "@zoonk/core/auth/ott/state";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser, generateOneTimeToken } from "@zoonk/e2e/fixtures/users";
import { expect, test } from "./fixtures";

function getRedirectLocation(response: APIResponse): string {
  const location = response.headers().location;

  if (!location) {
    throw new Error("Expected response to include a Location header");
  }

  return location;
}

async function createLoginState({
  baseURL,
  context,
}: {
  baseURL: string;
  context: BrowserContext;
}): Promise<string> {
  const state = crypto.randomUUID();

  await context.addCookies([
    { name: ONE_TIME_TOKEN_LOGIN_STATE_COOKIE, sameSite: "Lax", url: baseURL, value: state },
  ]);

  return state;
}

test.describe("Auth Callback", () => {
  test("redirects to home for backslash-based network-path return targets", async ({ browser }) => {
    const baseURL = getBaseURL();
    const user = await createE2EUser(baseURL);
    const token = await generateOneTimeToken(baseURL, user);
    const unsafeNextPath = String.raw`/\\evil.example/path`;

    const ctx = await browser.newContext({ baseURL });
    const state = await createLoginState({ baseURL, context: ctx });

    const response = await ctx.request.get(
      `/auth/callback?state=${encodeURIComponent(state)}&token=${encodeURIComponent(token)}&next=${encodeURIComponent(unsafeNextPath)}`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(302);
    expect(getRedirectLocation(response)).toBe("/");

    await ctx.close();
  });
});
