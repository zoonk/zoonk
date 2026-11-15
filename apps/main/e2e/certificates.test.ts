import { prisma } from "@zoonk/db";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { chapterLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { type Page, expect, test } from "./fixtures";
import { pressUntil } from "./study-day";

const COURSE_TITLE = "Atoms up close";
const MOCK_POSITION = 10_000;

/**
 * A plan of a Library course's whole Beginner level, its challenge won and one lesson left:
 * finishing that lesson finishes the level.
 */
async function createLastLessonGoal(userId: string, kind: "exam" | "learn" = "learn") {
  const [course, chapter, skill, { lesson }] = await Promise.all([
    courseFixture({ isPublished: true, title: COURSE_TITLE }),
    libraryChapterFixture({ title: "Inside the atom" }),
    skillFixture({ name: "Atoms" }),
    playableLessonFixture({ lesson: { title: "An almost empty atom" }, steps: ["explanation"] }),
  ]);

  // The level counts the chapters it had when the plan began, so the chapter joins it first.
  const [goal] = await Promise.all([
    goalFixture({ kind, primaryCourseId: course.id, timezone: "UTC", userId }),
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, level: "beginner" }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
  ]);

  const [plan] = await Promise.all([
    planFixture({
      goalId: goal.id,
      items: [
        {
          chapterId: chapter.id,
          lessonId: lesson.id,
          scheduledFor: new Date(Date.now() + MS_PER_DAY),
          skillId: skill.id,
        },
      ],
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId }),
  ]);

  await prisma.planItem.updateMany({
    data: { status: "done" },
    where: { kind: "boss", planId: plan.id },
  });

  return { goal, lesson, plan };
}

/** An exam's Beginner level finished, its certificate unclaimed, and a mock exam still ahead. */
async function createFinishedLevelExamGoal(userId: string) {
  const { goal, plan } = await createLastLessonGoal(userId, "exam");

  await Promise.all([
    prisma.planItem.updateMany({
      data: { status: "done" },
      where: { kind: { in: ["chapter", "lesson"] }, planId: plan.id },
    }),
    planItemFixture({
      kind: "mock",
      planId: plan.id,
      position: MOCK_POSITION,
      scheduledFor: new Date(Date.now() + 7 * MS_PER_DAY),
      titleSnapshot: "",
    }),
  ]);

  return goal;
}

async function finishLastLesson(page: Page, lessonId: string) {
  await page.goto(`/learn/${lessonId}`);
  await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
  const next = page.getByRole("button", { name: /^Continue/u });
  await expectHydrated(next);
  await next.click();

  const moment = page.getByRole("dialog", { name: "Beginner complete!" });
  await expect(moment).toBeVisible();
  return moment;
}

function readCertificate(goalId: string) {
  return prisma.certificate.findFirstOrThrow({
    select: { code: true, shownAt: true },
    where: { courseLevel: "beginner", goalId, kind: "course" },
  });
}

test.describe("Course certificates", () => {
  test("a Plus learner's finished level shows its certificate, whose link opens for anyone", async ({
    browser,
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const [{ goal, lesson }, name] = await Promise.all([
      createLastLessonGoal(noProgressUser.id),
      prisma.user.findUniqueOrThrow({ select: { name: true }, where: { id: noProgressUser.id } }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: noProgressUser.id, status: "active" },
      }),
    ]);

    const moment = await finishLastLesson(page, lesson.id);
    await expect(moment.getByText(`On your certificate: ${name.name}`)).toBeVisible();

    const certificate = await readCertificate(goal.id);

    // The moment ignores a tap in its first half second, meant for the screen before it.
    await pressUntil(() => moment.getByRole("button", { name: /^Continue/u }).click(), moment, {
      visible: false,
    });

    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    await expect
      .poll(async () => {
        const row = await readCertificate(goal.id);
        return row.shownAt;
      })
      .not.toBeNull();

    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();

    try {
      await visitorPage.goto(`/c/${certificate.code}`);

      await expect(
        visitorPage.getByRole("heading", {
          level: 1,
          name: `${name.name} completed ${COURSE_TITLE} · Beginner`,
        }),
      ).toBeVisible();

      await expect(visitorPage.getByRole("button", { name: "Share" })).toBeHidden();
    } finally {
      await visitor.close();
    }
  });

  test("a free learner's certificate waits behind the gate and stays theirs, and leaving keeps its moment", async ({
    browser,
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { goal, lesson } = await createLastLessonGoal(noProgressUser.id);
    const moment = await finishLastLesson(page, lesson.id);

    await expect(moment.getByRole("button", { name: "Share" })).toBeHidden();

    await moment.getByRole("link", { name: "See your certificate" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Certificates need a subscription" }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Share" })).toBeHidden();

    const certificate = await readCertificate(goal.id);
    expect(certificate.shownAt).toBeNull();

    await page.getByRole("link", { name: "Subscribe" }).click();
    await expect(page).toHaveURL(/\/subscription$/u);

    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();

    try {
      await visitorPage.goto(`/c/${certificate.code}`);

      await expect(
        visitorPage.getByRole("heading", { level: 1, name: "We couldn't find this certificate" }),
      ).toBeVisible();
    } finally {
      await visitor.close();
    }
  });

  test("a claim that doesn't save takes the done mark off its line", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await createFinishedLevelExamGoal(noProgressUser.id);
    await page.setViewportSize({ height: 844, width: 390 });

    await page.route(
      (url) => url.pathname.endsWith("/plan"),
      (route) => (route.request().method() === "POST" ? route.abort() : route.continue()),
    );

    await page.goto("/plan");
    const line = page.getByRole("region", { name: "Beginner complete" });
    await expect(line.locator('[data-slot="done-mark"]')).toBeVisible();

    const claim = line.getByRole("button", { name: "Get your certificate" });
    await expectHydrated(claim);
    await claim.click();

    await expect(line.getByRole("alert")).toHaveText("That didn't save. Try again.");
    await expect(line.locator('[data-slot="done-mark"]')).toHaveCount(0);
  });
});
