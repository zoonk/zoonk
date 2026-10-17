import { type Request, type Route } from "@playwright/test";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";

/**
 * The example line goes to the public API from the browser. Main's E2E runs without the API, so
 * this stands in for its answers (the API's own suite covers the endpoint, and the player's tests
 * what the line shows). Opening a screen only reads the line; writing one is new work that starts
 * from the learner's tap and takes seconds, and a Server Action would hold up every later one on
 * the page, so nothing may wait for that request.
 */

const RIGHT_TYPED = "It shows where the electron is likely to be";
const EXAMPLE_LINE_URL = "**/v1/me/example-lines/*";

function stepIdOf(route: Route) {
  return new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
}

function isExampleLine(request: Request, method: "GET" | "POST") {
  return request.method() === method && request.url().includes("/v1/me/example-lines/");
}

/**
 * Reads say a line can be written for this learner; asking keeps the line in flight until the test
 * lets it go, like a slow model call.
 */
async function holdExampleLine(page: Page) {
  const { promise: released, resolve: release } = Promise.withResolvers<null>();

  await page.route(EXAMPLE_LINE_URL, async (route) => {
    const stepId = stepIdOf(route);

    if (route.request().method() === "GET") {
      await route.fulfill({ json: { canRequest: true, line: null, stepId } });
      return;
    }

    await released;
    await route.fulfill({ json: { canRequest: false, line: null, stepId } }).catch(() => null);
  });

  return () => release(null);
}

test.describe("Example line requests", () => {
  test("reads as the learner on entry, writes only when asked, and never holds up a check", async ({
    page,
  }) => {
    const { lesson, steps } = await playableLessonFixture({
      steps: ["explanation", "typedAnswer"],
    });

    const releaseExampleLine = await holdExampleLine(page);
    const posts: string[] = [];

    page.on("request", (request) => {
      if (isExampleLine(request, "POST")) {
        posts.push(request.url());
      }
    });

    const read = page.waitForRequest((request) => isExampleLine(request, "GET"));
    await page.goto(`/learn/${lesson.id}`);
    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

    const reading = await read;
    expect(reading.url()).toContain(`/v1/me/example-lines/${steps[0]?.id}`);
    expect(reading.headers().authorization).toMatch(/^Bearer .+/u);

    // Opening the screen offers the example; only the learner's tap asks for it.
    const offer = page.locator('[data-slot="example-line-offer"]').getByRole("button");
    await expect(offer).toBeVisible();
    expect(posts).toStrictEqual([]);

    const asked = page.waitForRequest((request) => isExampleLine(request, "POST"));
    await offer.click();
    const asking = await asked;
    expect(asking.headers().authorization).toMatch(/^Bearer .+/u);

    // The line is still being written while the learner checks a typed answer on the next screen.
    await page.getByRole("button", { name: /^Next/u }).click();

    await page
      .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
      .fill(RIGHT_TYPED);

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
    expect(posts).toHaveLength(1);

    releaseExampleLine();
  });
});
