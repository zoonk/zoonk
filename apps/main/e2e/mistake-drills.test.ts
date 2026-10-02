import { prisma } from "@zoonk/db";
import { type Page, expect, test } from "./fixtures";
import { LESSON_IDEA, createDrillSession, drillQuestion } from "./mistake-drill-days";
import { answerRight, openAs } from "./study-day";

/** A timed drill gives each question 45 seconds; the clock jumps just past them. */
const PAST_THE_TIME_LIMIT = "00:46";
const TIME_LIMIT_MS = 45_000;
const TIMES_UP = "Time's up. It counts as a miss, so it comes back.";

/** The lesson's idea comes back first: its summary, the lesson a tap away, then the questions. */
async function expectIdeaFirst(page: Page, lessonId: string) {
  const firstQuestion = page.getByRole("heading", { name: drillQuestion("gap", "original") });

  await expect(page.getByText("The idea first, then a few questions on it.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why gap happens" })).toBeVisible();
  await expect(page.getByText(LESSON_IDEA)).toBeVisible();

  await expect(page.getByRole("link", { name: /^Go over the lesson/u })).toHaveAttribute(
    "href",
    new RegExp(`/learn/${lessonId}$`, "u"),
  );

  await expect(firstQuestion).toBeHidden();

  // Enter starts the questions; its listener attaches as the screen hydrates.
  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(firstQuestion).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 5000 });
}

/** The timed question's clock, then the jump past its 45 seconds. */
async function runOutOfTime(page: Page) {
  await expect(page.getByText("45 seconds a question, like on the day.")).toBeVisible();
  await expect(page.getByRole("timer", { name: "Time left" })).toHaveText(/^0:4\d$/u);
  await page.clock.fastForward(PAST_THE_TIME_LIMIT);
}

/** The timed question's answer: a miss that took the whole time box. */
async function expectTimedOut({ itemId, userId }: { itemId: string; userId: string }) {
  await expect
    .poll(() => prisma.attempt.count({ where: { isCorrect: false, itemId, userId } }))
    .toBe(1);

  const answer = await prisma.attempt.findFirstOrThrow({ where: { itemId, userId } });
  expect(answer.durationMs).toBeGreaterThanOrEqual(TIME_LIMIT_MS);
}

test.describe("Mistake drills", () => {
  test("today's practice plays each mistake's drill by its cause", async ({ browser }) => {
    const { drills, user } = await createDrillSession({ causes: ["gap", "time"], mode: "fun" });
    const [gap, time] = drills;
    const page = await openAs(browser, user);
    const feedback = page.getByRole("region", { name: "Answer feedback" });

    await page.clock.install();
    await page.goto("/session");
    await page.getByRole("button", { name: /^Start/u }).click();
    await expectIdeaFirst(page, gap?.lesson.id ?? "");
    await answerRight(page, drillQuestion("gap", "original"));
    await answerRight(page, drillQuestion("gap", "extra"));

    await expect(
      page.getByRole("heading", { name: drillQuestion("time", "original") }),
    ).toBeVisible();

    // While the clock runs, the question can't be voted on.
    await expect(page.getByRole("button", { name: "Question options" })).toBeHidden();
    await runOutOfTime(page);

    await expect(feedback.getByText("Not quite")).toBeVisible();
    await expect(feedback.getByText(TIMES_UP)).toBeVisible();
    await expect(page.getByRole("timer")).toBeHidden();

    await expectTimedOut({ itemId: time?.original.id ?? "", userId: user.id });

    // Its "…" menu takes a vote once the time is up, kept with the mode it was asked in.
    await page.getByRole("button", { name: "Question options" }).click();
    await page.getByRole("menuitemcheckbox", { exact: true, name: "Helpful" }).click();

    await expect
      .poll(() =>
        prisma.contentFeedback.findFirst({
          select: { contentKind: true, mode: true, vote: true },
          where: { contentId: time?.original.id, userId: user.id },
        }),
      )
      .toStrictEqual({ contentKind: "item", mode: "fun", vote: "up" });

    await page.context().close();
  });
});
