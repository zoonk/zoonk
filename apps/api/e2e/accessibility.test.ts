import { expect, test } from "@zoonk/e2e/fixtures";
import { expectAccessibleRoutes, expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { createTeenInvite, openAsGuardian } from "./helpers/guardian";

/**
 * Accessibility of the auth host's pages (sign-in, the email code, the untrusted-origin warning
 * and the guardian page), light and dark: no serious or critical axe violation.
 */

const SCAN_TIMEOUT_MS = 180_000;

test.describe.configure({ timeout: SCAN_TIMEOUT_MS });

test.describe("Auth pages are accessible", () => {
  test("sign-in, the email code, the untrusted-origin warning and a guardian invite", async ({
    page,
  }) => {
    await expectAccessibleRoutes(page, [
      { path: "/auth/login" },
      { path: "/auth/otp?email=learner@zoonk.test" },
      { path: "/auth/untrusted-origin" },
      { label: "a guardian invite before signing in", path: "/auth/guardian?token=invite-token" },
    ]);
  });

  test("the guardian page: accepting an invite and the learner's card", async ({
    baseURL,
    browser,
  }) => {
    const host = baseURL ?? "";
    const { context, guardian, page } = await openAsGuardian({ baseURL: host, browser });
    const { token } = await createTeenInvite({ baseURL: host, guardianEmail: guardian.email });

    await expectAccessibleRoutes(page, [
      { label: "the invite to accept", path: `/auth/guardian?token=${token}` },
    ]);

    await page.getByRole("button", { name: "Accept invite" }).click();
    await expect(page.getByRole("heading", { name: "Your learners" })).toBeVisible();

    await expectAccessibleScreen(page, "the learner's card");
    await context.close();
  });
});
