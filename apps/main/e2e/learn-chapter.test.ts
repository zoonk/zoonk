import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { studySessionBlockFixture } from "@zoonk/testing/fixtures/study-sessions";
import { runCoreSeedScript } from "./core-seed-script";
import { expect, test } from "./fixtures";
import { asPersona, findPlanChapterId } from "./learn-personas";
import { askSuggestion, stubScreenTutor } from "./screen-tutor";
import { proposeFutureRestDay, toProposal } from "./tutor-answer";

/**
 * A chapter of Maya's plan (quantum physics from scratch): she's in "Exponents and scientific
 * notation", the fourth chapter of the math phase, with "Powers of ten" done and an open mistake.
 */
const CHAPTER = "Exponents and scientific notation";

const EXTRA = { equals: true, path: ["extra"] };

function readChangeStatus(changeId: string) {
  return prisma.planChange
    .findUniqueOrThrow({ where: { id: changeId } })
    .then((change) => change.status);
}

/** The day's bonus practice used up: the block practice added, then a second one. */
async function useUpBonusPractice(goalId: string) {
  const added = await prisma.studySessionBlock.findFirstOrThrow({
    orderBy: { createdAt: "desc" },
    where: { payload: EXTRA, session: { goalId } },
  });

  const last = await prisma.studySessionBlock.findFirstOrThrow({
    orderBy: { position: "desc" },
    where: { sessionId: added.sessionId },
  });

  await Promise.all([
    prisma.studySessionBlock.update({ data: { status: "completed" }, where: { id: added.id } }),
    studySessionBlockFixture({
      kind: "practice",
      payload: { areaId: "bonus-second", extra: true, itemIds: [], skillIds: [] },
      position: last.position + 1,
      sessionId: added.sessionId,
      status: "completed",
    }),
  ]);

  return added.sessionId;
}

test.describe("Chapter page", () => {
  test("marks the first lesson of an unstarted chapter Up next, matching Start", async ({
    browser,
  }, testInfo) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
      const chapterId = await findPlanChapterId(user.goalId, "Vectors");

      await page.goto(`/content/chapters/${chapterId}`);
      await expect(page.getByRole("heading", { level: 1, name: "Vectors" })).toBeVisible();

      const lessons = page.getByRole("region", { name: "Lessons" });
      await expect(lessons.getByText("0 of 2", { exact: true })).toBeVisible();

      const next = lessons.getByRole("link", {
        name: /^Up next 1\. Arrows with size and direction/u,
      });

      await expect(next).toHaveCount(1);
      await expect(lessons.getByRole("img", { exact: true, name: "Up next" })).toHaveCount(1);

      await expect(page.getByRole("link", { exact: true, name: "Start" })).toHaveAttribute(
        "href",
        (await next.getAttribute("href")) ?? "",
      );

      await expect(
        lessons.getByRole("link", { name: /^Coming up 2\. Adding vectors/u }),
      ).toBeVisible();

      await page.setViewportSize({ height: 1000, width: 390 });
      await expect(next).toBeVisible();

      await page.screenshot({
        animations: "disabled",
        fullPage: true,
        path: testInfo.outputPath("unstarted-chapter-390.png"),
      });

      await page.setViewportSize({ height: 1000, width: 1440 });
      await expect(next).toBeVisible();

      await page.screenshot({
        animations: "disabled",
        fullPage: true,
        path: testInfo.outputPath("unstarted-chapter-1440.png"),
      });
    });
  });

  test("shows the chapter's lessons, mistakes and skills, takes a report and a question, and practices it up to the day's cap", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
      const [chapterId, outside, asked] = await Promise.all([
        findPlanChapterId(user.goalId, CHAPTER),
        prisma.chapter.findFirstOrThrow({ where: { title: "Light: wave or particle?" } }),
        stubScreenTutor(page),
      ]);

      const chapterUrl = new RegExp(`/content/chapters/${chapterId}$`, "u");

      // Chapters open from the Plan, which is the way back.
      await page.goto(`/content/chapters/${chapterId}`);
      await expect(page.getByRole("heading", { level: 1, name: CHAPTER })).toBeVisible();

      await expect(
        page.getByRole("main").getByRole("link", { name: "Back to Plan" }),
      ).toHaveAttribute("href", "/plan");

      // Numbered as her course lists it (its tenth chapter), not by where her plan teaches it.
      await expect(page.getByText("Chapter 10", { exact: true })).toBeVisible();
      // Its one way in right under its name, with how far she is in it in its facts.
      await expect(page.getByText(/^3 lessons(?: · About \d+\smin)? · 33% done$/u)).toBeVisible();

      await expect(page.getByRole("link", { exact: true, name: "Continue" })).toHaveAttribute(
        "href",
        /\/learn\/[\da-f-]{36}$/u,
      );

      // Every lesson opens in the player, in teaching order, the next one marked.
      const lessons = page.getByRole("region", { name: "Lessons" });
      await expect(lessons.getByText("1 of 3", { exact: true })).toBeVisible();
      await expect(lessons.getByRole("link")).toHaveCount(3);

      await expect(lessons.getByRole("link", { name: /^Up next \d+\. /u })).toHaveAttribute(
        "href",
        /\/learn\/[\da-f-]{36}$/u,
      );

      await expect(
        lessons.getByRole("link", { name: /^Done \d+\. Powers of ten/u }),
      ).toHaveAttribute("href", /\/learn\/[\da-f-]{36}$/u);

      await expect(lessons.getByRole("link", { name: /^Coming up \d+\. /u })).toHaveAttribute(
        "href",
        /\/learn\/[\da-f-]{36}$/u,
      );

      await expectAccessibleScreen(page, "a chapter");

      // Folded away in its summary: each skill with its state in words.
      const summary = page.getByRole("button", { name: "Chapter summary" });
      await expect(summary).toHaveAttribute("aria-expanded", "false");
      await summary.click();

      const skills = page.getByRole("region", { name: "Skills" });

      await expect(
        skills.getByRole("listitem").filter({ hasText: "Write a number in scientific notation" }),
      ).toHaveText(/^Write a number in scientific notation\s*Learning$/u);

      // She knows none of it yet, so the test that skips it is there.
      await expect(page.getByText("Already know this?")).toBeVisible();
      await expect(page.getByRole("button", { name: "Take the test" })).toBeEnabled();

      // Its menu only reports a problem: no votes on a chapter.
      await page.getByRole("button", { name: "Chapter options" }).click();
      await expect(page.getByRole("menuitem", { name: "Report a problem" })).toBeVisible();
      await expect(page.getByRole("menuitemcheckbox")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toBeHidden();

      // "Ask" is about the chapter as a whole, and closing it hands focus back to it.
      const tutor = await askSuggestion({
        ask: "Ask Zu about this chapter",
        description: "Ask questions about this chapter",
        page,
        suggestion: "What will I be able to do after this chapter?",
      });

      expect(asked).toStrictEqual([
        {
          input: expect.objectContaining({
            context: { kind: "chapter" },
            question: "What will I be able to do after this chapter?",
          }),
          path: `/v1/chapters/${chapterId}/questions`,
        },
      ]);

      await page.keyboard.press("Escape");
      await expect(tutor).toBeHidden();

      await expect(page.getByRole("button", { name: "Ask Zu about this chapter" })).toBeFocused();

      // General chapter practice adds a bonus block or opens its next lesson once today's
      // session has already asked every question. Targeted corrections live in the notebook.
      const practiceMistakes = page.getByRole("button", {
        exact: true,
        name: "Practice this chapter",
      });

      await practiceMistakes.click();
      await expect(page).toHaveURL(/\/(?:session|learn\/[^/?]+\?session=)/u);

      // Bonus practice stops at two blocks a day: after both, the tap says so and adds none.
      const sessionId = await useUpBonusPractice(user.goalId);
      await page.goto(`/content/chapters/${chapterId}`);
      await practiceMistakes.click();

      await expect(
        page.getByRole("status").filter({ hasText: "That's all the bonus practice for today." }),
      ).toBeVisible();

      await expect(page).toHaveURL(chapterUrl);

      await expect(
        prisma.studySessionBlock.count({ where: { payload: EXTRA, sessionId } }),
      ).resolves.toBe(2);

      // A chapter outside the learner's plan isn't hers to open.
      await page.goto(`/content/chapters/${outside.id}`);
      await expect(page.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
    });
  });

  // Persona pass 9: asked from a chapter's page, the buddy couldn't see the plan to change it.
  test("the buddy asked on a chapter proposes a change to the plan, applied only on the learner's tap", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
      // The hand-authored seed week omits Sunday's challenge; use the planner and a normal Open.
      const seeded = await prisma.studySession.findFirstOrThrow({
        orderBy: { localDate: "desc" },
        where: { goalId: user.goalId },
      });

      await prisma.studySession.delete({ where: { id: seeded.id } });
      await runCoreSeedScript("e2e-goal-plan.ts", ["--goal", user.goalId]);
      await page.goto("/today");
      await page.getByRole("button", { name: "Start session" }).click();

      await expect
        .poll(() =>
          prisma.studySession.count({
            where: { goalId: user.goalId, localDate: seeded.localDate },
          }),
        )
        .toBe(1);

      const [chapterId, plan] = await Promise.all([
        findPlanChapterId(user.goalId, CHAPTER),
        prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } }),
      ]);

      const { change, name: day } = await proposeFutureRestDay(plan.id);

      await stubScreenTutor(page, { planChange: toProposal(change) });
      await page.goto(`/content/chapters/${chapterId}`);

      const tutor = await askSuggestion({
        ask: "Ask Zu about this chapter",
        description: "Ask questions about this chapter",
        page,
        suggestion: "What will I be able to do after this chapter?",
      });

      // The card comes with the answer, as in the buddy's own conversation; nothing changes yet.
      const card = tutor.getByRole("region", { name: "Change to your plan" });
      await expect(card).toContainText(`${day}: rest day.`);
      expect(await readChangeStatus(change.id)).toBe("proposed");

      await card.getByRole("button", { name: "Apply" }).click();

      // A future rest day leaves today's session as it was.
      await expect(card.getByRole("status")).toHaveText("Your plan follows it from now on.");

      await expect.poll(() => readChangeStatus(change.id)).toBe("applied");
    });
  });
});
