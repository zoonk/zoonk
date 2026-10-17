import { type BrowserContext, type Page } from "@playwright/test";
import { SESSION_HINT_COOKIE, SESSION_HINT_TAG_PATTERN } from "@zoonk/auth/session-hint";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { privateCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { expect, test } from "./fixtures";
import { signInInAnotherTab } from "./session-switch";

const FIRST_GOAL = "Bake sourdough bread";
const SECOND_GOAL = "Play the cello";
const FIRST_COURSE = "Sourdough starters from scratch";

/**
 * One frame the page painted: when (page time), its document, the session hint the browser held,
 * whether the cover was up, and the learners' private titles it showed.
 */
type Frame = {
  at: number;
  covered: boolean;
  document: number;
  hint: string | null;
  titles: string[];
};

declare global {
  /** Where the page reports each frame it paints (`watchFrames`). */
  var zoonkPaintedFrame: ((frame: Frame) => void) | undefined;
}

/** A learner whose Plan shows `goal`. */
async function createLearner(goal: string) {
  const user = await createE2EUser(getBaseURL());
  const created = await goalFixture({ timezone: "UTC", title: goal, userId: user.id });

  await Promise.all([
    planFixture({ goalId: created.id }),
    learningProfileFixture({ activeGoalId: created.id, userId: user.id }),
  ]);

  return { goal: created, user };
}

/**
 * Records every frame the page paints, in every document it loads, with the learners' private
 * titles visible in it (their goals, a course): what a learner could have seen, frame by frame.
 */
async function watchFrames(page: Page): Promise<Frame[]> {
  const frames: Frame[] = [];

  await page.exposeFunction("zoonkPaintedFrame", (frame: Frame) => {
    frames.push(frame);
  });

  await page.addInitScript(
    ({ cookie, titles }) => {
      const sample = () => {
        const text = document.body?.innerText ?? "";
        const hint = document.cookie.split("; ").find((pair) => pair.startsWith(`${cookie}=`));

        globalThis.zoonkPaintedFrame?.({
          at: performance.timeOrigin + performance.now(),
          covered: Object.hasOwn(document.documentElement.dataset, "zoonkCover"),
          document: performance.timeOrigin,
          hint: hint?.slice(cookie.length + 1) ?? null,
          titles: titles.filter((title) => text.includes(title)),
        });

        requestAnimationFrame(sample);
      };

      requestAnimationFrame(sample);
    },
    { cookie: SESSION_HINT_COOKIE, titles: [FIRST_GOAL, SECOND_GOAL, FIRST_COURSE] },
  );

  return frames;
}

/** The frames painted from `since` (page time) on that showed `title` with nothing covering it. */
function shownUncovered({
  frames,
  since,
  title,
}: {
  frames: Frame[];
  since: number;
  title: string;
}) {
  return frames.filter(
    (frame) => frame.at >= since && !frame.covered && frame.titles.includes(title),
  );
}

/** The page's clock now, comparable with its frames' `at`. */
async function pageTime(page: Page) {
  return page.evaluate(() => performance.timeOrigin + performance.now());
}

function learningTab(page: Page, name: "Plan" | "Today") {
  return page.getByRole("navigation", { name: "Learning tabs" }).getByRole("link", { name });
}

function mainText(page: Page, text: string) {
  return page.getByRole("main").getByText(text).first();
}

async function openPage(context: BrowserContext, path: string) {
  const page = await context.newPage();
  await page.setViewportSize({ height: 900, width: 1440 });
  const frames = await watchFrames(page);
  await page.goto(path);
  return { frames, page };
}

/** The document the page shows now, as its frames report it. */
function currentDocument(frames: Frame[]) {
  return frames.at(-1)?.document;
}

/**
 * Holds the page's next load of `path` until the returned release, so the document it leaves stays
 * up until its cover was seen and a quick reload can't skip it. Nothing may ask the page while it
 * waits (that would wait for the load too): its frames say what it painted.
 */
async function holdReload(page: Page, path: string) {
  const reload = Promise.withResolvers<null>();

  await page.route(`**${path}`, async (route) => {
    if (route.request().isNavigationRequest()) {
      await reload.promise;
    }

    await route.continue();
  });

  return () => reload.resolve(null);
}

/** When `document` first painted with its cover up (page time); the test fails if it never did. */
async function coveredAt({ document, frames }: { document: number | undefined; frames: Frame[] }) {
  const at = () => frames.find((frame) => frame.document === document && frame.covered)?.at;
  await expect.poll(at).toBeDefined();
  return at() ?? 0;
}

test.describe("identity cover", () => {
  test("never shows a Plan the router kept for one learner after another signs in elsewhere", async ({
    browser,
  }) => {
    const [first, second] = await Promise.all([
      createLearner(FIRST_GOAL),
      createLearner(SECOND_GOAL),
    ]);

    const context = await browser.newContext({ storageState: first.user.storageState });
    const { frames, page } = await openPage(context, "/plan");
    await expect(mainText(page, FIRST_GOAL)).toBeVisible();

    // The learner moves on to Today; the router keeps their Plan for a quick way back.
    await learningTab(page, "Today").click();
    await page.waitForURL(/\/today$/u);
    const before = currentDocument(frames);

    await signInInAnotherTab({ context, user: second.user });

    // The learner comes back to the tab and takes the way back to the Plan: the page reloads as
    // the second learner instead.
    await page.bringToFront();
    const since = await pageTime(page);
    await learningTab(page, "Plan").dispatchEvent("click");
    await expect.poll(() => currentDocument(frames)).not.toBe(before);
    await learningTab(page, "Plan").click();
    await expect(mainText(page, SECOND_GOAL)).toBeVisible();

    expect(shownUncovered({ frames, since, title: FIRST_GOAL })).toStrictEqual([]);

    expect(
      frames.filter((frame) => frame.document === before && frame.titles.includes(SECOND_GOAL)),
    ).toStrictEqual([]);

    await context.close();
  });

  test("never shows a goal's start screen kept for one learner after another signs in elsewhere", async ({
    browser,
  }) => {
    const [first, second] = await Promise.all([
      createLearner(FIRST_GOAL),
      createLearner(SECOND_GOAL),
    ]);

    const context = await browser.newContext({ storageState: first.user.storageState });
    const { frames, page } = await openPage(context, `/start/${first.goal.id}`);
    await expect(page.getByText(FIRST_GOAL).first()).toBeVisible();
    const before = currentDocument(frames);
    const releaseReload = await holdReload(page, `/start/${first.goal.id}`);

    await signInInAnotherTab({ context, user: second.user });

    // The page covers itself as soon as the other learner signs in, then reloads for them, who
    // can't see that goal.
    const since = await coveredAt({ document: before, frames });
    releaseReload();
    await expect.poll(() => currentDocument(frames)).not.toBe(before);
    await page.bringToFront();
    await expect(page.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
    await expect(page.getByText(FIRST_GOAL)).toHaveCount(0);

    expect(shownUncovered({ frames, since, title: FIRST_GOAL })).toStrictEqual([]);

    await context.close();
  });

  test("never shows a course's start page kept for one learner after another signs in elsewhere", async ({
    browser,
  }) => {
    const [first, second] = await Promise.all([
      createLearner(FIRST_GOAL),
      createLearner(SECOND_GOAL),
    ]);

    // The first learner's own course: nobody else may see it.
    const { course } = await privateCourseFixture({ ownerId: first.user.id, title: FIRST_COURSE });

    const context = await browser.newContext({ storageState: first.user.storageState });
    const { frames, page } = await openPage(context, `/start/course/${course.id}`);
    await expect(mainText(page, FIRST_COURSE)).toBeVisible();
    const before = currentDocument(frames);
    const releaseReload = await holdReload(page, `/start/course/${course.id}`);

    await signInInAnotherTab({ context, user: second.user });

    // The first learner's page covers itself as soon as the other learner signs in, then reloads
    // for them, and they can't see that course.
    const since = await coveredAt({ document: before, frames });
    releaseReload();
    await expect.poll(() => currentDocument(frames)).not.toBe(before);
    await page.bringToFront();
    await expect(page.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
    await expect(page.getByText(FIRST_COURSE)).toHaveCount(0);

    expect(shownUncovered({ frames, since, title: FIRST_COURSE })).toStrictEqual([]);

    await context.close();
  });

  test("never shows a page the router shows again after another learner signed in elsewhere", async ({
    browser,
  }) => {
    const [first, second] = await Promise.all([
      createLearner(FIRST_GOAL),
      createLearner(SECOND_GOAL),
    ]);

    const context = await browser.newContext({ storageState: first.user.storageState });
    const { frames, page } = await openPage(context, "/plan");
    await expect(mainText(page, FIRST_GOAL)).toBeVisible();

    await learningTab(page, "Today").click();
    await page.waitForURL(/\/today$/u);

    await signInInAnotherTab({ context, user: second.user });

    // Back, to the Plan the router kept: covered and reloaded, never the first learner's.
    await page.bringToFront();
    const since = await pageTime(page);
    await page.goBack();
    await expect(mainText(page, SECOND_GOAL)).toBeVisible();

    expect(shownUncovered({ frames, since, title: FIRST_GOAL })).toStrictEqual([]);

    await context.close();
  });

  test("covers a private page before it paints when the browser holds someone else, even on a slow device", async ({
    browser,
  }) => {
    const [first, second] = await Promise.all([
      createLearner(FIRST_GOAL),
      createLearner(SECOND_GOAL),
    ]);

    // The session cookie is still the first learner's, but the browser's hint names the second:
    // a page rendered for the first arrives after the second signed in.
    const hint = second.user.storageState.cookies.find(({ name }) => name === SESSION_HINT_COOKIE);
    expect(hint?.value).toMatch(SESSION_HINT_TAG_PATTERN);

    const context = await browser.newContext({ storageState: first.user.storageState });
    await context.addCookies(hint ? [hint] : []);

    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });

    const frames = await watchFrames(page);
    let documents = 0;

    page.on("request", (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        documents += 1;
      }
    });

    await page.goto("/plan");

    // One automatic reload; the same reset again waits for the learner instead of looping.
    await expect(page.getByText("This page is out of date")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
    expect(documents).toBe(2);

    expect(shownUncovered({ frames, since: 0, title: FIRST_GOAL })).toStrictEqual([]);

    await context.close();
  });

  test("checks, says when it couldn't, and lets the learner try again from the cover", async ({
    browser,
  }) => {
    const { user } = await createLearner(FIRST_GOAL);
    const context = await browser.newContext({ storageState: user.storageState });
    const { page } = await openPage(context, "/plan");
    await expect(mainText(page, FIRST_GOAL)).toBeVisible();

    // The hint stops naming the learner while the session check can't get through.
    const held = Promise.withResolvers<null>();

    await page.route("**/api/auth/get-session**", async (route) => {
      await held.promise;
      await route.abort();
    });

    await context.clearCookies({ name: SESSION_HINT_COOKIE });
    await page.bringToFront();

    await expect(page.getByText("Checking your account…")).toBeVisible();
    held.resolve(null);

    await expect(page.getByText("Couldn't check your account")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();

    // Try again works from the cover itself, and the learner's page comes back.
    await page.unroute("**/api/auth/get-session**");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Couldn't check your account")).toBeHidden();
    await expect(mainText(page, FIRST_GOAL)).toBeVisible();

    await context.close();
  });
});
