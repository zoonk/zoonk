import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { expect, test } from "./fixtures";
import { carryLessons, openAs } from "./study-day";

const DAYS_PER_WEEK = 7;

test.describe("Today without a session to start", () => {
  test("follows a different device zone through the action and shows its day", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const deviceZone = "Pacific/Kiritimati";
    const deviceDay = getDateInTimeZone({ date: new Date(), timeZone: deviceZone });
    const storedZone = "Etc/GMT+12";

    const goal = await goalFixture({
      targetDate: new Date(deviceDay.getTime() + 10 * MS_PER_DAY),
      timezone: storedZone,
      userId: user.id,
    });

    const { lesson } = await playableLessonFixture({ steps: ["check"] });

    await Promise.all([
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      planFixture({ goalId: goal.id, items: [{ lessonId: lesson.id }] }),
    ]);

    const context = await browser.newContext({
      storageState: user.storageState,
      timezoneId: deviceZone,
    });

    const page = await context.newPage();
    await page.goto("/today");

    await expect
      .poll(async () => {
        const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
        return saved.timezone;
      })
      .toBe(deviceZone);

    const weekday = new Intl.DateTimeFormat("en", { timeZone: "UTC", weekday: "long" }).format(
      deviceDay,
    );

    await expect(page.getByText(`${weekday}: today`, { exact: true })).toBeAttached();
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
    await context.close();
  });

  test("Keep learning on a rest day adds the plan's next lessons, those earlier days left first, and opens the first", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const goal = await goalFixture({ dailyMinutes: 10, timezone: "UTC", userId: user.id });
    const today = toUTCMidnight(new Date());

    const weekdayMinutes = Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
      weekday === today.getUTCDay() ? 0 : goal.dailyMinutes,
    );

    const [session, upcoming] = await Promise.all([
      studySessionFixture({ goalId: goal.id, plannedMinutes: 0, userId: user.id }),
      Promise.all(
        ["Next lesson 1", "Next lesson 2"].map((title) =>
          playableLessonFixture({ lesson: { estimatedMinutes: 3, title }, steps: ["check"] }),
        ),
      ),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    await planFixture({
      goalId: goal.id,
      items: upcoming.map(({ lesson }, index) => ({
        lessonId: lesson.id,
        position: 3 + index,
        scheduledFor: new Date(today.getTime() + 2 * MS_PER_DAY),
        titleSnapshot: lesson.title,
      })),
      settings: { weekdayMinutes },
    });

    const missed = await carryLessons({ count: 2, goalId: goal.id });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const keepLearning = page.getByRole("button", { name: "Keep learning" });

    await expectHydrated(keepLearning);
    await keepLearning.click();
    await expect(page).toHaveURL(new RegExp(`/learn/${missed[0]?.id}\\?session=`, "u"));
    await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();

    await expect(
      prisma.studySessionBlock.findMany({
        orderBy: { position: "asc" },
        select: { kind: true, lessonId: true },
        where: { sessionId: session.id },
      }),
    ).resolves.toStrictEqual(
      [...missed, ...upcoming.map(({ lesson }) => lesson)].map((lesson) => ({
        kind: "learn",
        lessonId: lesson.id,
      })),
    );

    await page.context().close();
  });
});

test("an expanded day highlights only the current lesson on a touch screen", async ({
  browser,
}) => {
  const user = await createE2EUser(getBaseURL());
  const goal = await goalFixture({ dailyMinutes: 20, timezone: "UTC", userId: user.id });
  const lessonTitles = Array.from({ length: 6 }, (_, index) => `Today's lesson ${index + 1}`);

  const [session, lessons] = await Promise.all([
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    Promise.all(
      lessonTitles.map(async (title) => {
        const { lesson } = await playableLessonFixture({
          lesson: { estimatedMinutes: 3, title },
          steps: ["check"],
        });

        return lesson;
      }),
    ),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  const { items } = await planFixture({
    goalId: goal.id,
    items: lessons.map(({ id, title }) => ({ lessonId: id, titleSnapshot: title })),
  });

  await Promise.all(
    lessons.map((lesson, position) =>
      studySessionBlockFixture({
        estimatedMinutes: lesson.estimatedMinutes,
        lessonId: lesson.id,
        payload: { planItemId: items[position]?.id, title: lesson.title },
        position,
        sessionId: session.id,
      }),
    ),
  );

  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    storageState: user.storageState,
    timezoneId: "UTC",
    viewport: { height: 844, width: 390 },
  });

  try {
    const page = await context.newPage();
    await page.goto("/today");
    const expand = page.getByRole("button", { name: /^\+\d+ more$/u });
    await expectHydrated(expand);
    await expand.tap();

    const list = page
      .getByRole("list")
      .filter({ has: page.getByRole("link", { exact: true, name: "Today's lesson 6" }) });

    const revealed = list.getByRole("link", { exact: true, name: "Today's lesson 6" });
    await expect(revealed).toBeVisible();

    // Hold the pseudo-state a touch browser can leave behind, even though it cannot hover.
    expect(await page.evaluate(() => matchMedia("(hover: hover)").matches)).toBe(false);

    await revealed.evaluate((link) => {
      link.id = "revealed-lesson";
    });

    await page.addStyleTag({ content: "li::before { transition-duration: 0s !important; }" });
    const cdp = await context.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");

    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "#revealed-lesson",
    });

    await cdp.send("CSS.forcePseudoState", { forcedPseudoClasses: ["hover"], nodeId });

    const filled = await list
      .getByRole("listitem")
      .evaluateAll((rows) =>
        rows
          .filter((row) => getComputedStyle(row, "::before").backgroundColor !== "rgba(0, 0, 0, 0)")
          .map((row) => row.getAttribute("aria-current")),
      );

    expect(filled).toStrictEqual(["step"]);
  } finally {
    await context.close();
  }
});
