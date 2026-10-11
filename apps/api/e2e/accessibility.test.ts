import { test } from "@zoonk/e2e/fixtures";
import { expectAccessibleRoutes } from "@zoonk/e2e/fixtures/accessibility";

/**
 * Accessibility of the auth host's pages (sign-in, the email code and the untrusted-origin
 * warning), light and dark: no serious or critical axe violation.
 */

const SCAN_TIMEOUT_MS = 180_000;

test.describe.configure({ timeout: SCAN_TIMEOUT_MS });

test.describe("Auth pages are accessible", () => {
  test("sign-in, the email code and the untrusted-origin warning", async ({ page }) => {
    await expectAccessibleRoutes(page, [
      { path: "/auth/login" },
      { path: "/auth/otp?email=learner@zoonk.test" },
      { path: "/auth/untrusted-origin" },
    ]);
  });
});
