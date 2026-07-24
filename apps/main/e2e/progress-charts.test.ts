import { expect, test } from "./fixtures";

const CHART_SIZE_WARNING = "The width(-1) and height(-1) of chart should be greater than 0";

test.describe("Progress Charts", () => {
  test("Score trend renders without invalid size warnings", async ({ authenticatedPage }) => {
    const chartWarnings: string[] = [];

    authenticatedPage.on("console", (message) => {
      if (message.text().includes(CHART_SIZE_WARNING)) {
        chartWarnings.push(message.text());
      }
    });

    await authenticatedPage.goto("/score");

    await expect(
      authenticatedPage.getByRole("figure", { name: /weekly score trend/iu }),
    ).toBeVisible();

    expect(chartWarnings).toEqual([]);
  });
});
