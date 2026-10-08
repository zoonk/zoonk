import { type Route } from "@playwright/test";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";

/**
 * The example line goes to the public API from the browser. Main's E2E runs without the API, so
 * this stands in for its answer (the API's own suite covers the endpoint, and the player's tests
 * what the line shows). Writing a line takes seconds, and a Server Action would hold up every
 * later one on the page, so nothing may wait for this request.
 */

const RIGHT_TYPED = "It shows where the electron is likely to be";
const EXAMPLE_LINE_URL = "**/v1/me/example-lines/*";

function stepIdOf(route: Route) {
  return new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
}

/** Keeps the example line in flight until the test lets it go, like a slow model call. */
async function holdExampleLine(page: Page) {
  const { promise: released, resolve: release } = Promise.withResolvers<null>();

  await page.route(EXAMPLE_LINE_URL, async (route) => {
    await released;
    await route.fulfill({ json: { line: null, stepId: stepIdOf(route) } }).catch(() => null);
  });

  return () => release(null);
}

test.describe("Example line requests", () => {
  test("asks the API as the learner and never holds up a check while the line is written", async ({
    page,
  }) => {
    const { lesson, steps } = await playableLessonFixture({
      steps: ["explanation", "typedAnswer"],
    });

    const releaseExampleLine = await holdExampleLine(page);

    const lineRequest = page.waitForRequest(EXAMPLE_LINE_URL);
    await page.goto(`/learn/${lesson.id}`);
    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

    const line = await lineRequest;
    expect(line.method()).toBe("POST");
    expect(line.url()).toContain(`/v1/me/example-lines/${steps[0]?.id}`);
    expect(line.headers().authorization).toMatch(/^Bearer .+/u);

    // The line is still being written while the learner checks a typed answer on the next screen.
    await page.getByRole("button", { name: /^Next/u }).click();

    await page
      .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
      .fill(RIGHT_TYPED);

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();

    releaseExampleLine();
  });
});
