import { type Route } from "@playwright/test";
import { stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { type Mode, setDeviceMode } from "./learn-personas";

/**
 * "Simpler", "Go deeper" and the example line go to the public API from the browser, in Focus and
 * Fun. Main's E2E runs without the API, so these stand in for its answers (the API's own suite
 * covers the endpoints). Writing a version or a line takes seconds, and a Server Action would hold
 * up every later one on the page, so none of them may wait for these requests.
 */

const SIMPLER = { text: "Think of a blur instead of a dot.", title: "A blur" };

const DEEPER = {
  text: "Its **wave function** gives the odds of finding it.",
  title: "Wave function",
};

const EXAMPLE_LINE = "Like a spinning fan: you see where the blades might be, not where they are.";
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

/** The API's answer for a version: the one asked for, as the variants endpoint returns it. */
async function answerVariants(page: Page) {
  await page.route(VARIANTS_URL, async (route) => {
    const kind = requestedKind(route);

    await route.fulfill({
      json: {
        content: kind === "deeper" ? DEEPER : SIMPLER,
        id: crypto.randomUUID(),
        kind,
        stepId: stepIdOf(route, 2),
      },
    });
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

async function openLesson(page: Page, { lessonId, mode }: { lessonId: string; mode: Mode }) {
  await setDeviceMode(page.context(), mode);
  await page.goto(`/learn/${lessonId}`);
  await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
}

test.describe("Depth and example line requests", () => {
  test("writes a simpler and a deeper version through the API as the learner", async ({ page }) => {
    const { lesson, steps } = await playableLessonFixture({ steps: ["explanation", "check"] });
    await answerVariants(page);
    await openLesson(page, { lessonId: lesson.id, mode: "focus" });

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

    await expect(
      page.getByRole("dialog", { name: "Go deeper" }).getByText(DEEPER.title, { exact: true }),
    ).toBeVisible();
  });

  test("says when today's help is used up or the screen has no version", async ({ page }) => {
    const { lesson } = await playableLessonFixture({ steps: ["explanation", "check"] });

    await page.route(VARIANTS_URL, async (route) => {
      await (requestedKind(route) === "deeper"
        ? route.fulfill({
            json: { error: { code: "UNPROCESSABLE_ENTITY", message: "No version" } },
            status: 422,
          })
        : route.fulfill({
            json: {
              error: {
                code: "USAGE_LIMIT_REACHED",
                details: { limit: { limit: 40, period: "day", resource: "assist", tier: "guest" } },
                message: "This plan's limit is reached",
              },
            },
            status: 403,
          }));
    });

    await openLesson(page, { lessonId: lesson.id, mode: "fun" });

    await page.getByRole("button", { name: "Simpler" }).click();
    const simpler = page.getByRole("dialog", { name: "Simpler" });

    await expect(
      simpler.getByText("You've used today's free help. Create a free account to keep going."),
    ).toBeVisible();

    await expect(simpler.getByRole("link", { name: "Create a free account" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(simpler).toBeHidden();

    await page.getByRole("button", { name: "Go deeper" }).click();

    await expect(
      page
        .getByRole("dialog", { name: "Go deeper" })
        .getByText("This screen is already as simple and as deep as it gets."),
    ).toBeVisible();
  });

  test("shows a version written since the lesson was first opened, without asking again", async ({
    page,
  }) => {
    const { lesson, steps } = await playableLessonFixture({ steps: ["explanation", "check"] });
    const asked: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/variants")) {
        asked.push(request.url());
      }
    });

    await openLesson(page, { lessonId: lesson.id, mode: "focus" });

    // Written meanwhile by someone else, through the API, whose cache main never hears from.
    await stepVariantFixture({ content: SIMPLER, kind: "simpler", stepId: steps[0]!.id });
    await page.reload();
    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

    await page.getByRole("button", { name: "Simpler" }).click();
    const simpler = page.getByRole("dialog", { name: "Simpler" });

    await expect(simpler.getByText(SIMPLER.text)).toBeVisible();
    expect(asked).toStrictEqual([]);
  });

  test("shows the learner's example line under the explanation", async ({ page }) => {
    const { lesson, steps } = await playableLessonFixture({ steps: ["explanation", "check"] });

    await page.route(EXAMPLE_LINE_URL, (route) =>
      route.fulfill({ json: { line: EXAMPLE_LINE, stepId: stepIdOf(route, 1) } }),
    );

    const lineRequest = page.waitForRequest(EXAMPLE_LINE_URL);
    await openLesson(page, { lessonId: lesson.id, mode: "fun" });

    await expect(page.getByRole("complementary", { name: "Your example" })).toHaveText(
      EXAMPLE_LINE,
    );

    const sent = await lineRequest;
    expect(sent.method()).toBe("POST");
    expect(sent.url()).toContain(`/v1/me/example-lines/${steps[0]?.id}`);
    expect(sent.headers().authorization).toMatch(/^Bearer .+/u);
  });

  test("never holds up Simpler or checking an answer while the example line is written", async ({
    page,
  }) => {
    const { lesson } = await playableLessonFixture({ steps: ["explanation", "typedAnswer"] });
    const releaseExampleLine = await holdExampleLine(page);
    await answerVariants(page);

    const lineRequest = page.waitForRequest(EXAMPLE_LINE_URL);
    await openLesson(page, { lessonId: lesson.id, mode: "focus" });
    await lineRequest;

    // The line is still being written while the learner asks for a simpler version…
    await page.getByRole("button", { name: "Simpler" }).click();
    const simpler = page.getByRole("dialog", { name: "Simpler" });
    await expect(simpler.getByText(SIMPLER.text)).toBeVisible();
    await simpler.getByRole("button", { name: "Got it" }).click();

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
