import { BELT_COLORS_ORDER } from "@zoonk/utils/belt-level";
import { expect, test } from "./fixtures";

test.describe("Level", () => {
  test("draws every belt on the rack in its own color, ahead of the learner too", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/level");

    const belts = page.getByRole("list", { name: "Belt progression" }).getByRole("img");
    await expect(belts).toHaveCount(BELT_COLORS_ORDER.length);

    const colors = await belts.evaluateAll((icons) =>
      icons.map((icon) => getComputedStyle(icon).color),
    );

    expect(new Set(colors).size).toBe(BELT_COLORS_ORDER.length);
  });
});
