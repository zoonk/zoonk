import { expect, test } from "./fixtures";

const CHART_SIZE_WARNING = "The width(-1) and height(-1) of chart should be greater than 0";

const chartPages = [
  { chartName: /energy chart/i, label: "energy", path: "/energy" },
  { chartName: /brain power chart/i, label: "level", path: "/level" },
  { chartName: /score chart/i, label: "score", path: "/score" },
];

test.describe("Performance Charts", () => {
  for (const chartPage of chartPages) {
    test(`${chartPage.label} chart renders without invalid size warnings`, async ({
      authenticatedPage,
    }) => {
      const chartWarnings: string[] = [];

      authenticatedPage.on("console", (message) => {
        if (message.text().includes(CHART_SIZE_WARNING)) {
          chartWarnings.push(message.text());
        }
      });

      await authenticatedPage.goto(chartPage.path);
      await expect(
        authenticatedPage.getByRole("figure", { name: chartPage.chartName }),
      ).toBeVisible();

      expect(chartWarnings).toEqual([]);
    });
  }
});
