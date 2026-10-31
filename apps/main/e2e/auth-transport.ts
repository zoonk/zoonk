import { type Page } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";

/** Main has no central host in CI; keep the app's sign-out real and mock only that host. */
export async function mockCentralSignOut(page: Page): Promise<string[]> {
  const requests: string[] = [];

  await page.route("**/v1/auth/sign-out", (route) => {
    const method = route.request().method();

    if (method !== "OPTIONS") {
      requests.push(method);
    }

    return route.fulfill({
      body: JSON.stringify({ success: true }),
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Origin": getBaseURL(),
      },
    });
  });

  return requests;
}

/**
 * Main's CI has no central-auth server. Playwright routes only the first request of a redirect
 * chain, so the document redirect is split to intercept the external host.
 */
export async function mockCentralAuthTransport(page: Page) {
  const appOrigin = new URL(getBaseURL()).origin;

  await page.route("**/auth/login?**", (route) =>
    route.fulfill({ body: '<label>Email<input type="email"></label>', contentType: "text/html" }),
  );

  await page.route(
    (url) => url.origin === appOrigin && /^\/(?:[a-z]{2}\/)?login$/u.test(url.pathname),
    async (route) => {
      const response = await route.fetch({ maxRedirects: 0 });
      const location = response.headers().location;

      if (!location) {
        throw new Error("Expected Main's login handler to redirect to central auth");
      }

      const url = location.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

      await route.fulfill({
        body: `<meta http-equiv="refresh" content="0;url=${url}">`,
        headers: { ...response.headers(), "content-type": "text/html" },
        response,
        status: 200,
      });
    },
  );
}
