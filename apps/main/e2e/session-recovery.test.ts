import { prisma } from "@zoonk/db";
import { type Page, expect, test } from "./fixtures";
import { answerRight, createStudyDay, openAs } from "./study-day";

async function finishLesson(page: Page) {
  await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
  await page.getByRole("radio", { name: "Where the electron is most likely to be found" }).click();
  await page.getByRole("button", { exact: true, name: "Check" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Lesson complete" })).toBeVisible();
}

async function openPractice(browser: Parameters<typeof openAs>[0]) {
  const day = await createStudyDay({ reviewDone: true });
  const blocks = await prisma.studySessionBlock.findMany({ where: { sessionId: day.session.id } });
  const practice = blocks.find((block) => block.kind === "practice")!;

  await prisma.studySessionBlock.updateMany({
    data: { completedAt: new Date(), status: "completed" },
    where: { kind: "learn", sessionId: day.session.id },
  });

  const page = await openAs(browser, day.user);
  await page.goto("/today");
  await page.getByRole("button", { name: /^Continue/u }).click();
  await expect(page.getByRole("heading", { name: /^Practice one/u })).toBeVisible();
  const other = await page.context().newPage();
  await other.goto(page.url());
  await expect(other.getByRole("heading", { name: /^Practice one/u })).toBeVisible();
  return { ...day, other, page, practice };
}

test("a finished session lesson survives reload, Back and Forward without another start", async ({
  browser,
}) => {
  const { lesson, session, user } = await createStudyDay({ reviewDone: true });
  const page = await openAs(browser, user);

  try {
    await page.goto("/today");
    await page.getByRole("button", { name: /^Continue/u }).click();
    await finishLesson(page);
    const lessonUrl = page.url();

    const starts = () =>
      prisma.learningEvent.count({
        where: {
          contentIds: { equals: lesson.id, path: ["lessonId"] },
          kind: "lesson",
          userId: user.id,
        },
      });

    await expect.poll(starts).toBe(1);

    await expect
      .poll(() =>
        prisma.studySessionBlock.findFirst({ where: { kind: "learn", sessionId: session.id } }),
      )
      .toMatchObject({ status: "completed" });

    await page.reload();
    await expect(page.getByRole("heading", { exact: true, name: "Mixed practice" })).toBeVisible();
    await expect(page.getByText('What does the electron "cloud" show?')).toBeHidden();
    await expect.poll(starts).toBe(1);

    await page.goBack();
    await expect(page).toHaveURL(/\/today$/u);
    await page.goForward();
    await expect(page.getByRole("heading", { exact: true, name: "Mixed practice" })).toBeVisible();
    await expect.poll(starts).toBe(1);

    // A saved lesson address opened from the summary also belongs to that finished block.
    await page.getByRole("button", { exact: true, name: "Start" }).click();
    await answerRight(page, /^Practice one/u);
    await answerRight(page, /^Practice two/u);
    await expect(page.getByRole("heading", { level: 1, name: /^Done in /u })).toBeVisible();
    await page.goto(lessonUrl);
    await expect(page.getByRole("heading", { level: 1, name: /^Done in /u })).toBeVisible();
    await expect.poll(starts).toBe(1);
  } finally {
    await page.context().close();
  }
});

test("an answer saved in another tab is explained before continuing, and a finished session reloads there instead of an impossible retry", async ({
  browser,
}) => {
  const { other, page, practice, user } = await openPractice(browser);

  try {
    await answerRight(page, /^Practice one/u);
    await other.getByRole("radio", { name: "Wrong answer" }).click();
    await other.getByRole("button", { exact: true, name: "Check" }).click();
    await expect(other.getByRole("status")).toHaveText("You already answered this question.");
    await expect(other.getByRole("heading", { name: /^Practice one/u })).toBeVisible();
    await other.getByRole("button", { exact: true, name: "Continue" }).click();
    await expect(other.getByRole("heading", { name: /^Practice two/u })).toBeVisible();

    await expect
      .poll(() =>
        prisma.attempt.count({ where: { studySessionId: practice.sessionId, userId: user.id } }),
      )
      .toBe(1);

    // The first tab finishes the session while the second still shows its last question.
    await answerRight(page, /^Practice two/u);
    await expect(page.getByRole("heading", { level: 1, name: /^Done in /u })).toBeVisible();
    await other.getByRole("radio", { name: "Wrong answer" }).click();
    await other.getByRole("button", { exact: true, name: "Check" }).click();
    await expect(other.getByRole("heading", { level: 1, name: /^Done in /u })).toBeVisible();
    await expect(other.getByText("We couldn't save that answer. Check it again.")).toBeHidden();

    await expect
      .poll(() =>
        prisma.attempt.count({ where: { studySessionId: practice.sessionId, userId: user.id } }),
      )
      .toBe(2);
  } finally {
    await page.context().close();
  }
});
