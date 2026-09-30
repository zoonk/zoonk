import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleRoutes } from "@zoonk/e2e/fixtures/accessibility";
import { test } from "./fixtures";
import { MODES, asPersona } from "./learn-personas";

/**
 * Accessibility of the account and settings pages in Focus and in Fun, at phone and desktop
 * widths, light and dark (Fun is dark only, so it's scanned on a light device and checked to stay
 * dark): no serious or critical axe violation.
 */

const SCAN_TIMEOUT_MS = 300_000;

test.describe.configure({ timeout: SCAN_TIMEOUT_MS });

for (const mode of MODES) {
  test.describe(`Settings are accessible in ${mode}`, () => {
    test("an adult's settings, account and subscription", async ({ browser }) => {
      await asPersona(browser, { mode, persona: "hugeGoal" }, async ({ page }) => {
        await expectAccessibleRoutes(page, [
          { path: "/settings/appearance" },
          { path: "/settings/memory" },
          { path: "/profile" },
          { path: "/language" },
          { path: "/subscription" },
          { path: "/support" },
        ]);
      });
    });

    test("a Plus subscriber's plan", async ({ browser }) => {
      await asPersona(browser, { mode, persona: "hugeGoal" }, async ({ page, user }) => {
        const key = randomUUID().slice(0, 8);

        await prisma.subscription.create({
          data: {
            id: randomUUID(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            plan: "plus",
            provider: "stripe",
            referenceId: user.id,
            status: "active",
            stripeCustomerId: `cus_test_a11y_${key}`,
            stripeSubscriptionId: `sub_test_a11y_${key}`,
          },
        });

        await expectAccessibleRoutes(page, [{ path: "/subscription" }]);
      });
    });

    test("a teen's guardian settings", async ({ browser }) => {
      await asPersona(browser, { mode, persona: "minor" }, async ({ page }) => {
        await expectAccessibleRoutes(page, [
          { path: "/settings/guardian" },
          { path: "/settings/memory" },
          { path: "/today" },
        ]);
      });
    });
  });
}
