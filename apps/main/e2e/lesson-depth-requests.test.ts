import { type Route } from "@playwright/test";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { setDeviceMode } from "./learn-personas";

/**
 * "Simpler", "Go deeper" and the example line go to the public API from the browser. Main's E2E
 * runs without the API, so these stand in for its answers (the API's own suite covers the
 * endpoints, and the player's tests what each answer shows). Writing a version or a line takes
 * seconds, and a Server Action would hold up every later one on the page, so none of them may
 * wait for these requests.
 */

const SIMPLER = { text: "Think of a blur instead of a dot.", title: "A blur" };
const RIGHT_TYPED = "It shows where the electron is likely to be";

const VARIANTS_URL = "**/v1/steps/*/variants";
const EXAMPLE_LINE_URL = "**/v1/me/example-lines/*";

function stepIdOf(route: Route, fromEnd: number) {
  return new URL(route.request().url()).pathname.split("/").at(-fromEnd) ?? "";
}

/** The version the player asked for: the request's `kind`. */
function requestedKind(route: Route): unknown {
  const body: unknown = route.request().postDataJSON();
  return body && typeof body === "object" && "kind" in body ? body.kind : null;
}

/**
 * The API's answers for versions: the simpler one, and a 422 for the deeper one, which a screen
 * already as deep as it gets has none of.
 */
async function answerVariants(page: Page) {
  await page.route(VARIANTS_URL, async (route) => {
    await (requestedKind(route) === "deeper"
      ? route.fulfill({
          json: { error: { code: "UNPROCESSABLE_ENTITY", message: "No version" } },
          status: 422,
        })
      : route.fulfill({
          json: {
            content: SIMPLER,
            id: crypto.randomUUID(),
            kind: "simpler",
            stepId: stepIdOf(route, 2),
          },
        }));
  });
}

/** Keeps the example line in flight until the test lets it go, like a slow model call. */
async function holdExampleLine(page: Page) {
  const { promise: released, resolve: release } = Promise.withResolvers<null>();

  await page.route(EXAMPLE_LINE_URL, async (route) => {
    await released;
    await route.fulfill({ json: { line: null, stepId: stepIdOf(route, 1) } }).catch(() => null);
  });

  return () => release(null);
}

test.describe("Depth and example line requests", () => {
  test("asks the API as the learner and never holds up Simpler or a check while the example line is written", async ({
    page,
  }) => {
    const { lesson, steps } = await playableLessonFixture({
      steps: ["explanation", "typedAnswer"],
    });

    const releaseExampleLine = await holdExampleLine(page);
    await answerVariants(page);
    await setDeviceMode(page.context(), "focus");

    const lineRequest = page.waitForRequest(EXAMPLE_LINE_URL);
    await page.goto(`/learn/${lesson.id}`);
    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

    const line = await lineRequest;
    expect(line.method()).toBe("POST");
    expect(line.url()).toContain(`/v1/me/example-lines/${steps[0]?.id}`);
    expect(line.headers().authorization).toMatch(/^Bearer .+/u);

    // The line is still being written while the learner asks for a simpler version…
    const simplerRequest = page.waitForRequest(VARIANTS_URL);
    await page.getByRole("button", { name: "Simpler" }).click();

    const simpler = page.getByRole("dialog", { name: "Simpler" });
    await expect(simpler.getByText(SIMPLER.text)).toBeVisible();

    const sent = await simplerRequest;
    expect(sent.url()).toContain(`/v1/steps/${steps[0]?.id}/variants`);
    expect(sent.headers().authorization).toMatch(/^Bearer .+/u);
    expect(sent.postDataJSON()).toStrictEqual({ kind: "simpler" });

    await simpler.getByRole("button", { name: "Got it" }).click();
    await page.getByRole("button", { name: "Go deeper" }).click();

    const deeper = page.getByRole("dialog", { name: "Go deeper" });

    await expect(
      deeper.getByText("This screen is already as simple and as deep as it gets."),
    ).toBeVisible();

    await deeper.getByRole("button", { name: "Got it" }).click();

    // …and while they check a typed answer on the next screen.
    await page.getByRole("button", { name: /^Next/u }).click();

    await page
      .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
      .fill(RIGHT_TYPED);

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();

    releaseExampleLine();
  });
});
