import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { generateOneTimeToken } from "@zoonk/e2e/fixtures/users";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseBandsFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { mockCentralAuthTransport } from "./auth-transport";
import { startCourseWithLevel } from "./course-start";
import { type Page, expect, test } from "./fixtures";
import { routeTimeToCover } from "./time-to-cover-routes";

const GOAL_URL = /\/start\/(?<goalId>[0-9a-f-]{36})$/u;

/**
 * A published Library course of two Overview chapters with two lessons each, every lesson with
 * its own skill: what a course's outline looks like once its first band is written.
 */
async function createOutlinedCourse() {
  const id = randomUUID().slice(0, 8);
  const org = await getAiOrganization();

  const course = await courseFixture({
    isPublished: true,
    language: "en",
    organizationId: org.id,
    slug: `e2e-robotics-${id}`,
    title: `E2E Robotics ${id}`,
  });

  const chapters = await Promise.all(
    ["What robots are made of", "How robots decide"].map(async (title, position) => {
      const chapter = await libraryChapterFixture({
        homeCourseId: course.id,
        level: "overview",
        slug: `chapter-${position}-${id}`,
        title: `${title} ${id}`,
      });

      await courseChapterFixture({
        chapterId: chapter.id,
        courseId: course.id,
        level: "overview",
        position,
      });

      await Promise.all(
        [0, 1].map(async (lessonPosition) => {
          const name = `Lesson ${position + 1}.${lessonPosition + 1} ${id}`;

          const [lesson, skill] = await Promise.all([
            libraryLessonFixture({
              estimatedMinutes: 3,
              homeChapterId: chapter.id,
              level: "overview",
              slug: `lesson-${position}-${lessonPosition}-${id}`,
              title: name,
            }),
            skillFixture({ name: `Skill of ${name}` }),
          ]);

          await Promise.all([
            chapterLessonFixture({
              chapterId: chapter.id,
              lessonId: lesson.id,
              position: lessonPosition,
            }),
            lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
          ]);
        }),
      );

      return chapter;
    }),
  );

  // The course's other bands are written too, so a whole-course start plans from this outline.
  await courseBandsFixture({
    courseId: course.id,
    levels: ["beginner", "intermediate", "advanced"],
  });

  const coursePath = `/b/${org.slug}/c/${course.slug}`;

  return { chapterPath: `${coursePath}/ch/${chapters[1]?.slug}`, chapters, course, coursePath, id };
}

/**
 * The outlined course as a public exam course whose stored exam graph starts on it, its notice's
 * next exam day `examDay` ("YYYY-MM-DD", UTC): a start sets that day as the goal's date.
 */
async function createExamCourse(examDay: string) {
  const outlined = await createOutlinedCourse();
  const { course, id } = outlined;

  const [skill, blueprint] = await Promise.all([
    prisma.skill.findFirstOrThrow({ where: { name: `Skill of Lesson 1.1 ${id}` } }),
    examBlueprintFixture({
      edition: {
        citations: [],
        dates: [
          {
            citation: { passage: "Exam day", sourceId: "notice" },
            date: examDay,
            kind: "exam",
            label: "Exam",
          },
        ],
        noticeUrl: null,
        questionCount: null,
        sourceHash: null,
        timeZone: "UTC",
        year: Number(examDay.slice(0, 4)),
      },
    }),
    prisma.course.update({
      data: { format: "exam", visibility: "public" },
      where: { id: course.id },
    }),
  ]);

  await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: new Date(),
      graph: {
        phases: [{ milestone: null, name: "Exam" }],
        skills: [
          {
            area: null,
            courseIds: [course.id],
            lessons: 1,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          },
        ],
      },
      model: "fixture",
      primaryCourseId: course.id,
      promptVersion: "fixture",
      runId: "fixture",
    },
  });

  return outlined;
}

/** The lesson of each band after the Overview, which a plan from a chapter goes on to. */
const LATER_BAND_LESSONS = [
  "Test beginner lesson",
  "Test intermediate lesson",
  "Test advanced lesson",
];

/** The lessons of the goal's plan, in the order the plan teaches them. */
async function readPlanLessons(goalId: string) {
  const items = await prisma.planItem.findMany({
    include: { lesson: true },
    orderBy: { position: "asc" },
    where: { kind: "lesson", plan: { goalId } },
  });

  return items.map((item) => item.lesson?.title);
}

/**
 * Follows the way in from the page's first screen: "Build my plan", which opens the start page
 * ("Continue your plan" for a learner already studying the course, which the start page sends on).
 */
async function startFromHero(
  page: Page,
  { link = "Build my plan", name }: { link?: string; name: string },
) {
  const start = page.getByRole("region", { name }).getByRole("link", { name: link });
  await expect(start).toHaveAttribute("rel", "nofollow");
  await start.click();
}

async function readGoalId(page: Page): Promise<string> {
  await expect(page).toHaveURL(GOAL_URL);
  return GOAL_URL.exec(new URL(page.url()).pathname)?.groups?.goalId ?? "";
}

test.describe("Starting a course from its page", () => {
  test("asks the level before anything exists, then creates the goal on Start and asks only what's left", async ({
    page,
  }) => {
    const { course, coursePath } = await createOutlinedCourse();

    // The course's page sends a whole course's start to its start page: the tap creates nothing.
    await page.goto(coursePath);
    await startFromHero(page, { name: course.title });
    await expect(page).toHaveURL(new RegExp(`/start/course/${course.id}\\?minutes=15$`, "u"));

    // No goal to type, nothing to confirm: the first screen is the learner's level in the course.
    const level = "How much do you already know?";
    await expect(page.getByRole("heading", { level: 1, name: level })).toBeVisible();

    // The course's page stays in the app's frame, hidden, for going back: only the start shows.
    await expect(
      page.getByRole("main").getByText(course.title, { exact: true }).filter({ visible: true }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Build my plan" })).toBeDisabled();

    // The page's time a day comes along, said as the page's, since the visitor didn't pick it.
    await expect(
      page.getByText("15 minutes a day for now. You can change it in the next steps."),
    ).toBeVisible();

    // A visitor starts without an account, and is told so.
    const note = page
      .getByRole("main")
      .getByText("Start free, no account needed.")
      .filter({ visible: true });

    await expect(note).toBeVisible();
    await expectAccessibleScreen(page, level);

    await expect(page.getByRole("textbox", { name: "I want to" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeHidden();
    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);
    const session = await page.request.get("/api/auth/get-session");
    await expect(session.json()).resolves.toBeNull();

    await startCourseWithLevel(page);
    const goalId = await readGoalId(page);

    await expect(
      page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
    ).toBeVisible();

    // Leaving after the level (including a failed date render) must not activate the default
    // plan. Home leads to recovery, and continuing opens the same unanswered date screen.
    const beforeLeaving = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
    await page.goto("/");
    await expect(page).toHaveURL(/\/today$/u);
    await expect(page.getByText("Setting up", { exact: true })).toBeVisible();
    const resume = page.getByRole("link", { name: "Continue setting up" });
    await expect(resume).toHaveAttribute("href", `/start/${goalId}`);
    await expect(prisma.studySession.count({ where: { goalId } })).resolves.toBe(0);

    // The Plan says the same: no pace or catch-up for a plan built on answers not given yet.
    await page.getByRole("link", { exact: true, name: "Plan" }).filter({ visible: true }).click();

    await expect(
      page.getByRole("heading", { name: "Your plan comes after a few questions" }),
    ).toBeVisible();

    await expect(page.getByText("Pace", { exact: true })).toHaveCount(0);

    await expect(page.getByRole("link", { exact: true, name: "Continue" })).toHaveAttribute(
      "href",
      `/start/${goalId}`,
    );

    await page.getByRole("link", { exact: true, name: "Today" }).filter({ visible: true }).click();
    await resume.click();
    await expect(page).toHaveURL(new RegExp(`/start/${goalId}$`, "u"));

    await expect(
      page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: level })).toBeHidden();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).resolves.toMatchObject({
      dailyMinutes: beforeLeaving.dailyMinutes,
      details: beforeLeaving.details,
      targetDate: beforeLeaving.targetDate,
    });

    await expectAccessibleScreen(page, "Optional course date");
    const targetDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("Date", { exact: true }).fill(targetDate);
    await page.getByRole("button", { exact: true, name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Choose your buddy" })).toBeVisible();

    // The level is answered: onboarding goes on without asking it again.
    await expect(page.getByRole("heading", { name: level })).toBeHidden();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).resolves.toMatchObject({
      details: {
        answered: ["level", "targetDate"],
        courseStart: { chapterId: null },
        level: "basic",
      },
      kind: "learn",
      primaryCourseId: course.id,
      targetDate: new Date(`${targetDate}T00:00:00.000Z`),
      title: course.title,
    });

    // The course's page knows they study it now, and its way in brings them back to the same goal,
    // without asking their level again.
    await page.goto(coursePath);
    await startFromHero(page, { link: "Continue your plan", name: course.title });

    await expect(page).toHaveURL(new RegExp(`/start/${goalId}$`, "u"));
  });

  test("an exam course's date question leads with the exam's day: Continue keeps it, another date can clear it", async ({
    browser,
  }) => {
    const examDay = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);
    const { course } = await createExamCourse(examDay);
    const dateQuestion = /^Your exam is on /u;

    for (const keeps of [true, false]) {
      // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
      const context = await browser.newContext();

      try {
        // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
        const page = await context.newPage();
        // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
        await page.goto(`/start/course/${course.id}`);
        // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
        await startCourseWithLevel(page);
        // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
        const goalId = await readGoalId(page);

        // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
        await expect(page.getByRole("heading", { name: dateQuestion })).toBeVisible();

        if (keeps) {
          // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
          await page.getByRole("button", { exact: true, name: "Continue" }).click();
          // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
          await expect(page.getByRole("heading", { name: dateQuestion })).toBeHidden();
        } else {
          // Another date is the second path: the field opens on the exam's day, and no date
          // clears it.
          // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
          await page.getByRole("button", { name: "Another date" }).click();
          // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
          await expect(page.getByLabel("Date", { exact: true })).toHaveValue(examDay);
          // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
          await page.getByRole("button", { name: "No date, study everything" }).click();
          // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
          await expect(
            page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
          ).toBeHidden();
        }

        // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
        await expect
          .poll(async () => {
            const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
            return goal.targetDate?.toISOString().slice(0, 10) ?? null;
          })
          .toBe(keeps ? examDay : null);
      } finally {
        // oxlint-disable-next-line no-await-in-loop -- Each start is its own visitor.
        await context.close();
      }
    }
  });

  test("the time question opens on the time a day the course's page showed and Monday to Friday, and only the learner moves it", async ({
    page,
  }) => {
    const { course, coursePath } = await createOutlinedCourse();

    await page.goto(coursePath);
    await startFromHero(page, { name: course.title });

    await expect(page).toHaveURL(new RegExp(`/start/course/${course.id}\\?minutes=15$`, "u"));

    await expect(
      page.getByText("15 minutes a day for now. You can change it in the next steps."),
    ).toBeVisible();

    await startCourseWithLevel(page);
    const goalId = await readGoalId(page);

    // The plan needs four hours a day, which Find finds when she asks; the question marks it and
    // leaves the pick alone.
    const targetDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

    await page.route(`**/v1/goals/${goalId}/plan/time-advice**`, (route) =>
      route.fulfill({
        json: {
          coveredShare: 0.4,
          measure: "goal",
          numbers: null,
          readingNotice: false,
          ready: true,
          targetDate,
          targetDateNamedMonth: false,
        },
      }),
    );

    await routeTimeToCover(page, { goalId, time: { recommendedMinutes: 240, targetDate } });

    await page.getByLabel("Date", { exact: true }).fill(targetDate);
    await page.getByRole("button", { exact: true, name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Choose your buddy" })).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    const scratch = page.getByRole("button", { name: "Skip and start from the basics" });
    const time = page.getByRole("heading", { name: "How much time can you study each day?" });
    await expect(scratch.or(time)).toBeVisible();

    if (await scratch.isVisible()) {
      await scratch.click();
    }

    await expect(time).toBeVisible();
    const fifteen = page.getByRole("radio", { exact: true, name: "15 min" });
    await expect(fifteen).toBeChecked();
    await expect(page.getByText(/^5 days · /u)).toBeVisible();

    // No chip says what it covers until she asks.
    await expect(page.getByText("Covers everything", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Find the time that covers everything" }).click();

    // The time found is marked and takes focus, so Space picks it, but nothing is picked for her.
    const found = page.getByRole("radio", { name: /^4 hr\s*Covers everything$/u });
    await expect(found).toBeFocused();
    await expect(fifteen).toBeChecked();
    await expect(found).not.toBeChecked();

    // The learner moves it.
    await page
      .getByRole("radiogroup", { name: "Minutes a day" })
      .getByText("30 min", { exact: true })
      .click();

    await expect(page.getByRole("radio", { exact: true, name: "30 min" })).toBeChecked();
    await expect(fifteen).not.toBeChecked();
  });

  test("starts the plan at a chapter from the chapter's page, after saying what it will be", async ({
    noProgressUser,
    page,
  }) => {
    const { chapterPath, chapters, course, id } = await createOutlinedCourse();

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto(chapterPath);
    await startFromHero(page, { name: chapters[1]?.title ?? "" });

    // The tap only opens the start page, which says where the plan starts; nothing exists yet.
    await expect(page).toHaveURL(
      new RegExp(`/start/course/${course.id}\\?chapter=${chapters[1]?.id}$`, "u"),
    );

    await expect(page.getByRole("heading", { level: 1, name: chapters[1]?.title })).toBeVisible();
    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);

    // Logging in before committing keeps the chosen chapter through the real callback.
    const startPath = `/start/course/${course.id}?chapter=${chapters[1]?.id}`;
    const login = page.getByRole("link", { exact: true, name: "Log in" });
    await expect(login).toHaveAttribute("href", `/login?next=${encodeURIComponent(startPath)}`);

    await mockCentralAuthTransport(page);
    await login.click();
    await expect(page).toHaveURL(/\/auth\/login\?/u);

    const callback = new URL(new URL(page.url()).searchParams.get("redirectTo") ?? "");
    expect(callback.searchParams.get("next")).toBe(startPath);
    callback.searchParams.set("token", await generateOneTimeToken(getBaseURL(), noProgressUser));
    await page.goto(callback.toString());
    await expect(page).toHaveURL(startPath);
    await expect(page.getByRole("heading", { level: 1, name: chapters[1]?.title })).toBeVisible();
    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);

    await page.getByRole("button", { name: "Build my plan" }).click();
    const goalId = await readGoalId(page);

    // A chapter start still offers an optional date, then the buddy and time, without placement.
    await expect(page.getByRole("heading", { name: "How much do you already know?" })).toBeHidden();

    await expect(
      page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "No date, study everything" }).click();
    await expect(page.getByRole("heading", { name: "Choose your buddy" })).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "How much time can you study each day?" }),
    ).toBeVisible();

    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
    expect(goal.details).toMatchObject({ courseStart: { chapterId: chapters[1]?.id } });
    expect(goal.details).toMatchObject({ answered: expect.arrayContaining(["targetDate"]) });
    expect(goal.targetDate).toBeNull();
    expect(goal.userId).toBe(noProgressUser.id);

    await expect(readPlanLessons(goalId)).resolves.toStrictEqual([
      `Lesson 2.1 ${id}`,
      `Lesson 2.2 ${id}`,
      ...LATER_BAND_LESSONS,
    ]);
  });

  test("asks the level from the course's first chapter, as its course does", async ({ page }) => {
    const { chapters, course, coursePath, id } = await createOutlinedCourse();
    const [first] = chapters;

    // A lesson of the first chapter leads to the same start, with no chapter to begin at.
    await page.goto(`${coursePath}/ch/${first?.slug}/l/lesson-0-0-${id}`);

    await expect(
      page
        .getByRole("region", { name: `This lesson is part of the ${course.title} course.` })
        .getByRole("link", { name: "Build my plan" }),
    ).toHaveAttribute("href", `/start/course/${course.id}`);

    await page.goto(`${coursePath}/ch/${first?.slug}`);
    await startFromHero(page, { name: first?.title ?? "" });

    await expect(page).toHaveURL(new RegExp(`/start/course/${course.id}$`, "u"));

    await expect(
      page.getByRole("heading", { level: 1, name: "How much do you already know?" }),
    ).toBeVisible();

    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);
  });

  test("an empty later chapter opens the whole-course start without creating a goal", async ({
    page,
  }) => {
    const { course, coursePath, id } = await createOutlinedCourse();

    const empty = await libraryChapterFixture({
      homeCourseId: course.id,
      level: "overview",
      slug: `empty-later-${id}`,
      title: `Empty later chapter ${id}`,
    });

    await courseChapterFixture({
      chapterId: empty.id,
      courseId: course.id,
      level: "overview",
      position: 2,
    });

    await page.goto(`${coursePath}/ch/${empty.slug}`);
    await startFromHero(page, { name: empty.title });

    await expect(page).toHaveURL(new RegExp(`/start/course/${course.id}$`, "u"));

    await expect(
      page.getByRole("heading", { level: 1, name: "How much do you already know?" }),
    ).toBeVisible();

    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);

    const session = await page.request.get("/api/auth/get-session");
    await expect(session.json()).resolves.toBeNull();
  });

  test("starts the plan at a lesson's chapter from the plan under the lesson", async ({ page }) => {
    const { chapters, course, coursePath, id } = await createOutlinedCourse();

    await page.goto(`${coursePath}/ch/${chapters[1]?.slug}/l/lesson-1-0-${id}`);

    await page
      .getByRole("region", { name: `This lesson is part of the ${course.title} course.` })
      .getByRole("link", { name: "Build my plan" })
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/start/course/${course.id}\\?chapter=${chapters[1]?.id}$`, "u"),
    );

    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);
    await page.getByRole("button", { name: "Build my plan" }).click();
    const goalId = await readGoalId(page);
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    expect(goal.details).toMatchObject({ courseStart: { chapterId: chapters[1]?.id } });

    await expect(readPlanLessons(goalId)).resolves.toStrictEqual([
      `Lesson 2.1 ${id}`,
      `Lesson 2.2 ${id}`,
      ...LATER_BAND_LESSONS,
    ]);
  });

  test("a course start prefetched as blocked checks again after the active goal is paused elsewhere", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const [{ course, coursePath }, goal] = await Promise.all([
      createOutlinedCourse(),
      goalFixture({ userId: noProgressUser.id }),
    ]);

    const prefetched = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/start/course/${course.id}` &&
        (response.request().headers()["next-router-segment-prefetch"] ?? "").endsWith("/__PAGE__"),
    );

    // The wall comes with the learner's own facts, in the runtime prefetch, which can land after
    // the page's static part: both are in before the goal is paused elsewhere. The server renders
    // the runtime prefetch whole before it answers, so its answer coming in is enough.
    const ownFactsPrefetched = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/start/course/${course.id}` &&
        response.request().headers()["next-router-prefetch"] === "2",
    );

    await page.goto(coursePath);
    const response = await prefetched;
    await response.finished();
    await ownFactsPrefetched;
    await prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } });
    await startFromHero(page, { name: course.title });

    await expect(
      page.getByRole("heading", { name: "How much do you already know?" }),
    ).toBeVisible();

    await expect(page.getByRole("radiogroup", { name: "Your level" })).toBeVisible();
    await expect(page.getByRole("link", { name: "See Plus" })).toHaveCount(0);
  });

  // The wall said to pause the goal on the Plan, but its one button was "Get Plus": the free way
  // had no button at all. Its Plus button says "See Plus", as everywhere else in the app.
  test("a free learner following another goal is told up front, with Plus first and the way to pause the goal they're on", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const [{ course, coursePath }, goal] = await Promise.all([
      createOutlinedCourse(),
      goalFixture({ userId: noProgressUser.id }),
    ]);

    await planFixture({ goalId: goal.id });
    await page.goto(coursePath);
    await startFromHero(page, { name: course.title });
    await expect(page).toHaveURL(new RegExp(`/start/course/${course.id}\\?minutes=15$`, "u"));

    // Nothing to answer that couldn't start: why, Plus first, and the free way under it.
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();

    await expect(
      page.getByRole("alert").filter({ hasText: "The free plan follows one goal at a time." }),
    ).toBeVisible();

    const toPlan = page.getByRole("link", { name: "Go to your Plan" });

    await expect(page.getByRole("link", { name: /^(?:See Plus|Go to your Plan)$/u })).toHaveText([
      "See Plus",
      "Go to your Plan",
    ]);

    await expect(page.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      "/subscription",
    );

    await expect(toPlan).toHaveAttribute("href", "/plan");
    await expect(page.getByRole("radiogroup", { name: "Your level" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Build my plan" })).toHaveCount(0);

    // Signed in, they have an account already: no note about starting without one.
    await expect(
      page.getByRole("main").getByText("Start free, no account needed.").filter({ visible: true }),
    ).toHaveCount(0);

    await expect(
      prisma.goal.count({ where: { primaryCourseId: course.id, userId: noProgressUser.id } }),
    ).resolves.toBe(0);

    await expectAccessibleScreen(page, "Course start after the free plan's one goal");

    // The Plan's "…" is where the goal they're on pauses.
    await toPlan.click();
    await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();
    await page.getByRole("button", { name: "Plan options" }).click();
    await expect(page.getByRole("menuitem", { name: "Pause this goal" })).toBeVisible();
  });
});
