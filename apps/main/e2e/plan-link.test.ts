import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { expect, test } from "./fixtures";

test("keeps the shared plan in the only start action and leaves the footer clear", async ({
  page,
}) => {
  const owner = await userFixture();
  const goal = await goalFixture({ userId: owner.id });
  const plan = await planFixture({ goalId: goal.id });

  await page.setViewportSize({ height: 480, width: 360 });
  await page.goto(`/plan-link/${plan.id}`);

  const start = page.getByRole("link", { exact: true, name: "Start my own plan" });
  await expect(start).toHaveAttribute("href", new RegExp(`[?&]plan=${plan.id}$`, "u"));
  await expect(page.getByRole("link", { exact: true, name: "Build my plan" })).toHaveCount(0);
  await page.evaluate(() => globalThis.scrollTo(0, document.documentElement.scrollHeight));

  await expect
    .poll(async () => {
      const [footer, action] = await Promise.all([
        page.getByRole("contentinfo").boundingBox(),
        start.boundingBox(),
      ]);

      return Boolean(footer && action && footer.y + footer.height <= action.y);
    })
    .toBe(true);

  await start.click();
  await expect(page).toHaveURL(new RegExp(`/start\\?.*\\bplan=${plan.id}$`, "u"));
});
