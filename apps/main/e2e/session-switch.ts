import { type BrowserContext, request as apiRequest, expect } from "@playwright/test";
import { ONE_TIME_TOKEN_LOGIN_STATE_COOKIE } from "@zoonk/core/auth/ott/state";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EUser, generateOneTimeToken } from "@zoonk/e2e/fixtures/users";

/**
 * Signs `user` in through the app's real sign-in callback in another tab of the same browser, as
 * a learner does: the response sets their session and its paired hint, and the context's other
 * pages share those cookies and hear the tab on the learner's channel.
 */
export async function signInInAnotherTab({
  context,
  user,
}: {
  context: BrowserContext;
  user: E2EUser;
}) {
  const auth = await apiRequest.newContext({ baseURL: getBaseURL() });

  const signIn = await auth.post("/api/auth/sign-in/email", {
    data: { email: user.email, password: user.password },
  });

  expect(signIn.ok()).toBe(true);
  const storageState = await auth.storageState();
  await auth.dispose();

  const token = await generateOneTimeToken(getBaseURL(), { ...user, storageState });
  const state = crypto.randomUUID();

  await context.addCookies([
    { name: ONE_TIME_TOKEN_LOGIN_STATE_COOKIE, sameSite: "Lax", url: getBaseURL(), value: state },
  ]);

  const other = await context.newPage();

  await other.goto(
    `/auth/callback?state=${encodeURIComponent(state)}&token=${encodeURIComponent(token)}`,
  );

  await other.waitForURL(/\/today$/u);
  return other;
}
