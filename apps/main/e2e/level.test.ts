import { BELT_COLORS_ORDER } from "@zoonk/utils/belt-level";
import { expect, test } from "./fixtures";

test.describe("Level", () => {
  test("draws every belt on the path in its own color, ahead of the learner too", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/level");

    const belts = page.getByRole("list", { name: "Belt progression" }).getByRole("img");
    await expect(belts).toHaveCount(BELT_COLORS_ORDER.length);

    const colors = await belts.evaluateAll((dots) =>
      dots.map((dot) => getComputedStyle(dot).backgroundColor),
    );

    expect(new Set(colors).size).toBe(BELT_COLORS_ORDER.length);
  });
});
