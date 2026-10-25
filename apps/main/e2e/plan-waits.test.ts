import { randomUUID } from "node:crypto";
import { type Page, type Request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { runtimePrefetchRead } from "./runtime-prefetch";
import { openAs } from "./study-day";

/**
 * The plan's waits move on by themselves: a stand-in for a lesson still being written turns into
 * its chapter once its outline lands, without a refresh, and an own-words edit that hangs says so.
 */

/** What the path says of its phase's lessons still being written, under its rows. */
const WRITING_LINE = "More lessons for this phase are being written.";

/** Stand-ins are read again every 10 seconds while lessons are being written. */
const WRITING_REFRESH_MS = 10_000;

const ONE_HOUR_MS = 60 * 60 * 1000;

/** A learner whose active goal has a plan. */
async function createPlanLearner() {
  const user = await createE2EUser(getBaseURL());

  const goal = await goalFixture({
    timezone: "UTC",
    title: `Ratios ${randomUUID().slice(0, 6)}`,
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

  return { goal, user };
}

/**
 * A plan whose first lessons stand in for a skill until its outline lands (no lesson, no chapter),
 * scheduled today, and the outline that lands for them. The plan was saved an hour before the
 * learner opens it, so nothing in it changed since the page read it until the outline lands.
 */
async function createPlanBeingWritten(goalId: string) {
  const suffix = randomUUID().slice(0, 6);
  const savedAt = new Date(Date.now() - ONE_HOUR_MS);

  const [plan, skill, chapter, lesson] = await Promise.all([
    planFixture({ goalId, updatedAt: savedAt }),
    skillFixture({ name: `Unit rates ${suffix}` }),
    libraryChapterFixture({ title: `Rates and ratios ${suffix}` }),
    libraryLessonFixture({ title: `What a unit rate is ${suffix}` }),
  ]);

  const standIn = await planItemFixture({
    planId: plan.id,
    scheduledFor: toUTCMidnight(new Date()),
    skillId: skill.id,
    titleSnapshot: "",
    updatedAt: savedAt,
  });

  /** The outline lands the way the API's run writes it: the stand-in gets its lesson and chapter. */
  const landOutline = () =>
    prisma.planItem.update({
      data: { chapterId: chapter.id, lessonId: lesson.id, titleSnapshot: lesson.title },
      where: { id: standIn.id },
    });

  return { chapter, landOutline };
}

/** A Server Action posts to the page that sends it: the Plan's asks go to /plan. */
function isPlanAsk(request: Request) {
  return new URL(request.url()).pathname === "/plan" && Boolean(request.headers()["next-action"]);
}

/**
 * Counts, as they're sent, the Plan's asks and the times it reads itself again after asking.
 * Opening a prefetched copy first fetches what the prefetch leaves out, before the page shows and
 * asks, so that fetch never counts as reading itself again.
 */
function watchPlanRequests(page: Page) {
  const requests = { asked: 0, readsAfterAsking: 0 };

  page.on("request", (request) => {
    const headers = request.headers();

    if (isPlanAsk(request)) {
      requests.asked += 1;
    } else if (
      requests.asked > 0 &&
      headers.rsc &&
      !headers["next-router-prefetch"] &&
      new URL(request.url()).pathname === "/plan"
    ) {
      requests.readsAfterAsking += 1;
    }
  });

  return requests;
}

// The Plan opened from a copy older than a few seconds (a link's prefetch, a visit a while ago) read
// itself whole again each time, a second render that also dropped every page the browser had
// prefetched: it asks whether its plan changed, and reads itself again only when it did.
test("an old copy of the Plan asks whether it changed instead of reading itself again", async ({
  browser,
}) => {
  const { goal, user } = await createPlanLearner();
  await createPlanBeingWritten(goal.id);

  const page = await openAs(browser, user);
  await page.clock.install();

  const prefetched = runtimePrefetchRead(page, "/plan");
  await page.goto("/stats");
  await prefetched;

  // The prefetched copy grows older than a few seconds before the learner opens it.
  await page.clock.fastForward(5000);

  const requests = watchPlanRequests(page);
  const answeredOnShow = page.waitForResponse((response) => isPlanAsk(response.request()));

  await page
    .locator('[data-slot="learn-side-navigation"]')
    .getByRole("link", { name: /^Plan/u })
    .click();

  await expect(page.getByRole("list", { name: "Your path" }).getByText(WRITING_LINE)).toBeVisible();
  await expect.poll(() => requests.asked).toBeGreaterThan(0);
  await answeredOnShow;

  // With the answer to its first ask in, the clock moves on: its wait then asks every 10 seconds,
  // each ask after the answer before it and any read that answer started.
  await expect(async () => {
    await page.clock.fastForward(WRITING_REFRESH_MS);
    expect(requests.asked).toBeGreaterThanOrEqual(3);
  }).toPass();

  expect(requests.readsAfterAsking).toBe(0);
  await page.context().close();
});

// Another device can change what the Plan shows without touching its plan (another goal chosen,
// the buddy renamed): an old copy reads itself again once the learner's revision has moved on.
test("an old copy of the Plan reads itself again once the learner changed something elsewhere", async ({
  browser,
}) => {
  const { goal, user } = await createPlanLearner();
  await createPlanBeingWritten(goal.id);

  const page = await openAs(browser, user);
  await page.clock.install();

  const prefetched = runtimePrefetchRead(page, "/plan");
  await page.goto("/stats");
  await prefetched;

  // Another device saves a change of the learner's, then the prefetched copy has grown old.
  await prisma.user.update({ data: { learnerRevision: { increment: 1 } }, where: { id: user.id } });
  await page.clock.fastForward(5000);

  const requests = watchPlanRequests(page);

  await page
    .locator('[data-slot="learn-side-navigation"]')
    .getByRole("link", { name: /^Plan/u })
    .click();

  await expect.poll(() => requests.readsAfterAsking).toBeGreaterThan(0);
  await page.context().close();
});

// An old copy whose ask goes unanswered (offline, a server error) can't tell whether it changed:
// it reads itself again, as it did before it asked.
test("an old copy of the Plan reads itself again when its ask fails", async ({ browser }) => {
  const { goal, user } = await createPlanLearner();
  await createPlanBeingWritten(goal.id);

  const page = await openAs(browser, user);
  await page.clock.install();

  const prefetched = runtimePrefetchRead(page, "/plan");
  await page.goto("/stats");
  await prefetched;
  await page.clock.fastForward(5000);

  await page.route(
    (url) => url.pathname === "/plan",
    (route) => (isPlanAsk(route.request()) ? route.abort() : route.fallback()),
  );

  const requests = watchPlanRequests(page);

  await page
    .locator('[data-slot="learn-side-navigation"]')
    .getByRole("link", { name: /^Plan/u })
    .click();

  await expect.poll(() => requests.readsAfterAsking).toBeGreaterThan(0);
  await page.context().close();
});

test.describe("Lessons being written in the plan", () => {
  // An open Plan waiting on lessons used to read itself whole every 10 seconds (~500 queries
  // each time): it asks whether anything changed, and reads itself again only when it did.
  test("while nothing lands, the Plan asks whether it changed instead of reading itself again, and the lesson being written turns into its chapter on its own", async ({
    browser,
  }) => {
    const { goal, user } = await createPlanLearner();
    const { chapter, landOutline } = await createPlanBeingWritten(goal.id);

    const page = await openAs(browser, user);
    await page.clock.install();
    await page.goto("/plan");

    // The phase the learner is in is open, saying its lessons are still being written.
    const path = page.getByRole("list", { name: "Your path" });
    await expect(path.getByText(WRITING_LINE)).toBeVisible();
    await expect(path.getByRole("link")).toHaveCount(0);

    // A page that hydrates after the clock moved on asks once more as an old copy
    // (`useRefreshWhenOld`); what matters is that asking never reads it.
    const requests = watchPlanRequests(page);

    // The page starts asking once it hydrates, so the clock moves on until it has asked three
    // times: each ask goes out after the answer before it, and any read that answer started.
    await expect(async () => {
      await page.clock.fastForward(WRITING_REFRESH_MS);
      expect(requests.asked).toBeGreaterThanOrEqual(3);
    }).toPass();

    expect(requests.readsAfterAsking).toBe(0);
    await expect(path.getByText(WRITING_LINE)).toBeVisible();

    // The outline lands; the plan's next read, without a refresh, shows its chapter.
    await landOutline();
    await page.clock.fastForward(WRITING_REFRESH_MS);

    await expect(path.getByRole("link", { name: new RegExp(chapter.title, "u") })).toHaveAttribute(
      "href",
      `/content/chapters/${chapter.id}`,
    );

    await expect(path.getByText(WRITING_LINE)).toBeHidden();
    await page.context().close();
  });
});
