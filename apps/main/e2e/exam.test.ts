import { randomUUID } from "node:crypto";
import { type Locator, type Request, type Route } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { ensureGuest } from "@zoonk/e2e/fixtures/guests";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import {
  QUOTED_STATEMENT_CITATION,
  addGradedEssay,
  addTodayMock,
  createNetScoredPracticeDay,
  playMock,
} from "./exam-fixtures";
import {
  ENEM_INSTRUCTION,
  createApFreeResponseDay,
  createEnemEssayDay,
  createSatExamAfterMock,
} from "./exam-scale-fixtures";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { captureMissionEnding } from "./mission-ending-captures";
import { nextStep, stepDots } from "./result-steps";
import { askSuggestion, stubScreenTutor } from "./screen-tutor";
import { openAs } from "./study-day";

const NOT_THROUGH = "That didn't go through. Your answers are saved. Try again in a moment.";

/**
 * Holds every POST `matches` picks, like a server that doesn't answer, until `release`; later ones
 * go through. With the page's clock run ahead, a wait shows it's bounded.
 */
async function holdPosts(page: Page, matches: (request: Request) => boolean) {
  const held: Route[] = [];
  let holding = true;

  await page.route("**/*", async (route) => {
    const request = route.request();

    if (holding && request.method() === "POST" && matches(request)) {
      held.push(route);
      return;
    }

    await route.fallback();
  });

  return {
    release: async () => {
      holding = false;
      await Promise.all(held.map((route) => route.abort().catch(() => null)));
    },
    /** Lets later POSTs through, still holding the ones already held. */
    stopHolding: () => {
      holding = false;
    },
  };
}

/** Holds every Server Action whose body matches (see `holdPosts`). */
function holdServerActions(page: Page, matches: (body: string) => boolean) {
  return holdPosts(
    page,
    (request) => Boolean(request.headers()["next-action"]) && matches(request.postData() ?? ""),
  );
}

/** The Plan's first number, preparation, as the aside draws it at the tests' desktop width. */
function preparationNumber(page: Page) {
  return page
    .locator('[data-slot="journey-standing"]')
    .filter({ visible: true })
    .getByRole("button", { name: /^Preparation/u });
}

/** Where an element is drawn; it must be. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("The element isn't drawn");
  }

  return box;
}

/**
 * A result's buddy sits where every task's does, never in the header's corner: at the aside's
 * foot on a laptop, in the action bar's row, and its face after the main action on a phone (the
 * header's corner had "Ask" there), where Continue keeps the row's room even on a small phone and
 * the questions sit under it. The page goes back to its own size after.
 */
async function expectAskWhereTasksHaveIt(page: Page) {
  const size = page.viewportSize() ?? { height: 720, width: 1280 };
  const ask = page.getByRole("button", { name: "Ask Zu about this mock exam" });
  // The page left keeps its own bars, hidden, for going back: only the result's count.
  const bar = page.locator('[data-slot="task-action-bar"]').filter({ visible: true });
  const header = page.locator('[data-slot="task-header"]').filter({ visible: true });
  const aside = page.getByRole("complementary", { name: "After this mock exam" });

  await expect(header.getByRole("button")).toHaveCount(0);
  await expect(ask).toBeVisible();

  const [askBox, asideBox, barBox] = await Promise.all([boxOf(ask), boxOf(aside), boxOf(bar)]);

  expect(askBox.x).toBeGreaterThanOrEqual(asideBox.x);
  expect(askBox.y).toBeGreaterThan(barBox.y);

  await page.setViewportSize({ height: 844, width: 390 });
  await expect(ask).toBeVisible();
  const [phoneAsk, phoneBar] = await Promise.all([boxOf(ask), boxOf(bar)]);
  expect(phoneAsk.y).toBeGreaterThan(phoneBar.y);

  await page.setViewportSize({ height: 740, width: 360 });
  const questions = bar.getByRole("button", { name: /^See the (?:\d+ )?questions?$/u });
  await expect(questions).toBeVisible();

  const [main, questionsBox] = await Promise.all([
    boxOf(bar.getByRole("button", { name: /^Continue/u })),
    boxOf(questions),
  ]);

  expect(questionsBox.y).toBeGreaterThanOrEqual(main.y + main.height);
  await page.setViewportSize(size);
}

test.describe("Exam goal", () => {
  test("a day, a mock in real conditions with its answer sheet, bounded waits and a tutor once handed in, and its result", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      await page.goto("/today");

      const card = page.getByRole("region", { name: "Today's session" });
      await card.getByRole("button", { name: /^Continue/u }).click();
      await expect(page).toHaveURL(/\/learn\/[\w-]+\?session=[\w-]+$/u);

      const [mock, asked] = await Promise.all([
        addTodayMock({ goalId: user.goalId, userId: user.id }),
        stubScreenTutor(page),
      ]);

      // Its start (from its challenge's intro, by plan item) and hand-in are held at first: past
      // their usual time they say they're still working, and past their limit they stop waiting
      // and offer to try again.
      const isStart = (body: string) => body.includes(mock.planItemId);

      const isHandIn = (body: string) => body.includes(mock.blockId) && !body.includes("itemId");

      await page.clock.install();
      const starting = await holdServerActions(page, isStart);

      // Before it starts, the mock's own page is its challenge's intro.
      await page.goto(`/mock/${mock.blockId}`);
      await expect(page).toHaveURL(new RegExp(`/challenge/${mock.planItemId}$`, "u"));

      // Her second: she took her first one last Sunday.
      await expect(page.getByRole("heading", { level: 1, name: "Mock exam 2" })).toBeVisible();

      await expect(page.getByText(/only shows at the end/u)).toBeVisible();
      await expectAccessibleScreen(page, "a mock's intro");

      const start = page.getByRole("button", { name: "Start the mock exam" });
      await start.click();
      await expect(page.getByRole("button", { name: "Starting…" })).toBeDisabled();
      await page.clock.fastForward(11_000);

      await expect(
        page.getByText("Still starting. This is taking longer than usual."),
      ).toBeVisible();

      await page.clock.fastForward(35_000);
      await expect(page.getByText("That didn't go through. Try again in a moment.")).toBeVisible();

      await starting.release();
      await start.click();
      await expect(page).toHaveURL(new RegExp(`/mock/${mock.blockId}$`, "u"));

      await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
      await expect(page.getByText(/^Question 1 of \d+/u)).toBeVisible();

      // No tutor while the mock is running.
      await expect(page.getByRole("button", { name: "Ask Zu about this mock exam" })).toBeHidden();

      const flag = page.getByRole("button", { name: "Flag" });
      await flag.click();
      await expect(flag).toHaveAttribute("aria-pressed", "true");

      // At desktop width the sheet stays beside the question, with its count and jump buttons.
      const wideSheet = page.getByRole("complementary", { name: "Answer sheet" });
      await expect(wideSheet.getByText(/0 answered · 1 flagged/u)).toBeVisible();
      await expect(page.getByRole("button", { name: "Answer sheet" })).toBeHidden();
      await wideSheet.getByRole("button", { exact: true, name: "Question 2" }).click();
      await expect(page.getByText(/^Question 2 of \d+/u)).toBeVisible();
      await page.keyboard.press("ArrowLeft");

      // On a phone the sheet opens a drawer, and closing it brings focus back to its trigger.
      const size = page.viewportSize() ?? { height: 720, width: 1280 };
      await page.setViewportSize({ height: 844, width: 390 });
      const answerSheet = page.getByRole("button", { name: "Answer sheet" });
      await expect(answerSheet).toHaveAttribute("aria-haspopup", "dialog");
      await answerSheet.click();
      const sheet = page.getByRole("dialog", { name: "Answer sheet" });

      await expect(sheet.getByText(/0 answered · 1 flagged/u)).toBeVisible();
      await sheet.getByRole("button", { name: "Question 2" }).click();

      await expect(page.getByText(/^Question 2 of \d+/u)).toBeVisible();
      await expect(sheet).toBeHidden();
      await expect(answerSheet).toBeFocused();

      await page.keyboard.press("ArrowLeft");
      await expect(page.getByText(/^Question 1 of \d+/u)).toBeVisible();
      await page.setViewportSize(size);

      // The mock flags the first question as it's played, so the flag comes off first.
      await flag.click();
      await expect(flag).toHaveAttribute("aria-pressed", "false");

      const handingIn = await holdServerActions(page, isHandIn);
      await playMock({ answers: mock.answers, page });

      await expect(page.getByRole("button", { name: "Handing in…" })).toBeDisabled();
      await page.clock.fastForward(11_000);

      await expect(
        page.getByText("Still handing it in. This is taking longer than usual."),
      ).toBeVisible();

      await page.clock.fastForward(35_000);
      await expect(page.getByText(NOT_THROUGH)).toBeVisible();

      await handingIn.release();

      // Handing in is confirmed first, with what's still open: the question flagged as unsure.
      await page.getByRole("button", { name: "Hand in the mock exam" }).click();
      const confirm = page.getByRole("alertdialog", { name: "Hand in the mock exam?" });
      await expect(confirm.getByText(/^1 question is flagged\./u)).toBeVisible();
      await expectAccessibleScreen(page, "handing a mock in");
      await confirm.getByRole("button", { name: "Hand in" }).click();

      // The score is a range labeled as an estimate, with its breakdown and review on the page.
      await expect(
        page.getByRole("heading", { level: 1, name: /^Mock exam 2 done\s*\d+–\d+$/u }),
      ).toBeVisible();

      await expect(page.getByText(/^Estimated score · /u)).toBeVisible();
      await expectAccessibleScreen(page, "a mock's result");
      await expectAskWhereTasksHaveIt(page);

      // One score per area of the exam day, each named once; never the day's name for an area.
      const areas = page.getByRole("region", { name: "By area" });
      await expect(areas.getByRole("heading", { level: 2, name: "By area" })).toBeVisible();
      await expect(areas.getByText("Matemática", { exact: true })).toBeVisible();
      await expect(areas.getByText("Ciências da Natureza", { exact: true })).toBeVisible();

      await expect(
        page.getByText("Ciências da Natureza e Matemática", { exact: true }),
      ).toHaveCount(0);

      // Preparation and the next action stay in the aside, while the question is reviewed inline.
      const after = page.getByRole("complementary", { name: "After this mock exam" });
      await expect(after.getByText(/^\d+% → \d+%$/u)).toBeVisible();
      await expect(after.getByRole("heading", { name: "Your preparation" })).toBeVisible();
      await expect(after.getByText("1 mistake to review", { exact: true })).toBeVisible();

      // Its mistakes are reviewed in the notebook now; practice brings them back from tomorrow.
      await expect(page.getByRole("link", { name: "Review the mistake" })).toHaveAttribute(
        "href",
        /\/mistakes$/u,
      );

      await expect(page.getByRole("link", { name: "Continue today's session" })).toBeVisible();

      const review = page.getByRole("region", { name: "Questions to review" });
      await expect(review.getByRole("radio", { name: /Correct$/u })).toBeVisible();
      await expect(review.getByRole("radio", { name: /Your answer$/u })).toBeVisible();

      // Once it's handed in, "Ask" is about the mock as a whole.
      await askSuggestion({
        ask: "Ask Zu about this mock exam",
        description: "Ask questions about this mock exam",
        page,
        suggestion: "What should I practice first?",
      });

      expect(asked).toStrictEqual([
        {
          input: expect.objectContaining({
            context: { kind: "mock" },
            question: "What should I practice first?",
          }),
          path: `/v1/mocks/${mock.blockId}/questions`,
        },
      ]);
    });
  });

  // Ana handed a math mock in with most of it blank, and its result said only "230–390", nothing
  // of what she answered. An estimated score now shows the answers it comes from, as a net score's
  // tiles do: right, wrong and blank. The mock was her last mission of the day, so its result says
  // so with the day's bonus, on a reload too. Her Plan and the exam's page then count it.
  test("an estimated score shows the right, wrong and blank answers it comes from, the mission it completed, and her preparation", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const mock = await addTodayMock({ goalId: user.goalId, userId: user.id });

      const block = await prisma.studySessionBlock.findUniqueOrThrow({
        where: { id: mock.blockId },
      });

      // Taking the mock is the day's only mission.
      await prisma.studySession.update({
        data: {
          missions: {
            picks: [
              {
                anchor: { blockKind: "checkpoint", planItemId: mock.planItemId },
                kind: "mock",
                total: 1,
              },
            ],
            version: 1,
          },
        },
        where: { id: block.sessionId },
      });

      const answer = async (pick: "right" | "wrong") => {
        const question = await page
          .getByRole("main")
          .getByRole("heading", { level: 2 })
          .textContent();

        const answers = mock.answers.get(question?.trim() ?? "");

        await page.getByRole("radio", { name: answers?.[pick] }).click();
        await page.getByRole("button", { name: "Next" }).click();
      };

      await page.goto(`/mock/${mock.blockId}`);
      await page.getByRole("button", { name: "Start the mock exam" }).click();

      await expect(page.getByText(/^Question 1 of 6/u)).toBeVisible();
      await answer("wrong");
      await expect(page.getByText(/^Question 2 of 6/u)).toBeVisible();
      await answer("right");
      await expect(page.getByText(/^Question 3 of 6/u)).toBeVisible();

      // Handed in early, from the answer sheet.
      await page
        .getByRole("complementary", { name: "Answer sheet" })
        .getByRole("button", { exact: true, name: "Hand in" })
        .click();

      await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

      const heading = page.getByRole("heading", {
        level: 1,
        name: /^Mock exam 2 done\s*\d+–\d+$/u,
      });

      await expect(heading).toBeVisible();

      const tiles = page.locator('[data-slot="stat-tile"]').filter({ visible: true });

      await expect(tiles).toHaveText([/^Right\s*1$/u, /^Wrong\s*1$/u, /^Blank\s*4$/u]);

      await expect(
        page.getByText("Blank answers count as wrong, as on exam day.", { exact: true }),
      ).toBeVisible();

      const expectMissionDone = async () => {
        await expect(page.getByText("Mission done: Take the mock")).toBeVisible();
        await expect(page.getByRole("button", { name: "+50 Brain Power" })).toBeVisible();
        await expect(page.getByText("from today's missions")).toBeVisible();
      };

      await expectMissionDone();

      // The result reads what handing it in recorded, so a reload says the same.
      await page.reload();
      await expect(heading).toBeVisible();
      await expectMissionDone();

      await expect(
        prisma.studySession.findUniqueOrThrow({ where: { id: block.sessionId } }),
      ).resolves.toMatchObject({ fullMealAt: expect.any(Date) });

      await captureMissionEnding(page, test.info(), "mock");

      // The estimate lives behind the Plan's number; the exam's page says what's on it.
      await page.goto("/plan");
      await preparationNumber(page).click();

      await expect(
        page
          .getByRole("dialog", { name: "Your preparation" })
          .locator('[data-slot="estimated-score"]')
          .getByText(/^\d+ to \d+$/u),
      ).toBeVisible();

      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Plan options" }).click();
      await page.getByRole("menuitem", { name: "About the exam" }).click();
      await expect(page).toHaveURL(/\/exam$/u);

      // The page is named after the exam, with its days left over the name.
      await expect(page.getByRole("heading", { level: 1, name: "ENEM" })).toBeVisible();

      await expect(
        page
          .getByRole("main")
          .getByText(/\d+ days? left/u)
          .filter({ visible: true })
          .first(),
      ).toBeVisible();

      await expect(page.getByText(/^Estimated score/u)).toBeHidden();

      // The exam day by day, as its notice sets it out, beside the page: each day's date and
      // length over what it holds.
      const days = page.getByRole("region", { name: "The two days" });
      await expect(days).toContainText("180 questions");
      const firstDay = days.getByRole("listitem").first();

      await expect(firstDay.getByText("Day 1", { exact: true })).toBeVisible();
      await expect(firstDay.getByText(/^[A-Z][a-z]+, Nov \d+(?:, \d{4})?$/u)).toBeVisible();
      await expect(firstDay.getByText("5 hr 30 min", { exact: true })).toBeVisible();

      await expect(
        firstDay.getByText("Linguagens, Ciências Humanas e redação · 90 questions", {
          exact: true,
        }),
      ).toBeVisible();

      await expect(page.getByRole("link", { name: /^Mock exam 2/u })).toBeVisible();
      await expect(page.getByRole("link", { name: /^Mock exam 1/u })).toBeVisible();
      await expectAccessibleScreen(page, "the exam page");
    });
  });

  test("an essay graded by the official rubric, with one next step and a rewrite that keeps its text when grading is slow or fails", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const essay = await addGradedEssay({ goalId: user.goalId, userId: user.id });
      // Long enough for an ENEM grade (60 words), so the send reaches grading instead of the length check.
      const draft = [
        "Minha segunda versão deixa a proposta de intervenção completa. O governo federal, por meio do Ministério da Educação,",
        "deve ampliar programas de leitura nas escolas públicas, com bibliotecas abertas no contraturno e oficinas semanais.",
        "Assim, os estudantes terão contato frequente com livros, o que melhora a escrita e a argumentação.",
        "Além disso, as famílias podem participar de encontros mensais, fortalecendo o hábito de ler em casa e na comunidade.",
      ].join(" ");

      const isSubmission = (request: Request) =>
        new URL(request.url()).pathname === `/api/essays/${essay.blockId}/submissions`;

      // The first send is held, so its wait shows it's bounded; the next one reaches grading.
      await page.clock.install();

      const grading = await holdPosts(
        page,
        (request) => isSubmission(request) && (request.postData() ?? "").includes(draft),
      );

      await page.goto(`/essay/${essay.blockId}`);

      // The grade in two steps: the estimated range with each criterion, then the next step and
      // the proposal's missing elements together, followed by rewriting.
      await expect(
        page.getByRole("heading", { level: 1, name: /^Your essay\s*660–740$/u }),
      ).toBeVisible();

      await expect(
        page.getByText("Estimated score, from 0 to 1,000", { exact: true }),
      ).toBeVisible();

      const scores = page.getByRole("list", { name: "Score by criterion" });

      await expect(scores.getByText("Intervention proposal")).toBeVisible();
      // Each competency out of its own points, as ENEM scores it.
      await expect(scores.getByText("80 of 200", { exact: true })).toBeVisible();
      await expectAccessibleScreen(page, "a graded essay");

      await nextStep(page);
      await expect(page.getByText("Next step", { exact: true })).toBeVisible();

      await expect(
        page.getByRole("heading", { level: 1, name: "Intervention proposal" }),
      ).toBeVisible();

      await expect(page.getByText("Say by what means the proposal will work.")).toBeVisible();
      await expect(page.getByText("By what means, missing")).toBeAttached();

      // Rewriting keeps the next step in view, over the draft to rework, and the last grade beside
      // it. The rubric names the screen, as every task's title does.
      await page.getByRole("button", { exact: true, name: "Rewrite" }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: "Essay · ENEM rubric" }),
      ).toBeVisible();

      await expect(page.getByRole("complementary", { name: "Your last grade" })).toBeVisible();
      await expect(page.getByText("Next step: Intervention proposal")).toBeVisible();

      const rewrite = page.getByLabel("Rewrite what needs work");
      await expect(rewrite).toHaveValue("Meu primeiro rascunho da redação.");

      // Typing before the page hydrates is lost, so fill until the word count React keeps follows it.
      await expect(async () => {
        await rewrite.fill(draft);
        await expect(rewrite).toHaveValue(draft, { timeout: 1000 });
        await expect(page.getByText(/^\d{2,} words$/u)).toBeVisible({ timeout: 1000 });
      }).toPass();

      // Once graded, grading the rewrite is the main action.
      const send = page.getByRole("button", { name: "Grade the rewrite" });

      const failed = page.getByText(
        "That didn't go through. Your text is still here. Try again in a moment.",
      );

      const firstSend = page.waitForRequest(isSubmission);
      await send.click();
      const firstRequest = await firstSend;
      const { attemptId } = firstRequest.postDataJSON() as { attemptId: string };
      await expect(page.getByRole("button", { name: "Grading…" })).toBeDisabled();
      await page.clock.fastForward(21_000);

      await expect(
        page.getByText("Still grading. This is taking longer than usual."),
      ).toBeVisible();

      // The line makes the bar taller, and the aside beside it ends above the bar, so the bar's
      // hairline still crosses the window.
      const [lastGrade, gradingBar] = await Promise.all([
        boxOf(page.getByRole("complementary", { name: "Your last grade" })),
        boxOf(page.locator('[data-slot="task-action-bar"]')),
      ]);

      expect(lastGrade.y + lastGrade.height).toBeLessThanOrEqual(gradingBar.y);

      await page.clock.fastForward(70_000);
      await expect(failed).toBeVisible();
      await expect(send).toBeEnabled();
      await expect(rewrite).toHaveValue(draft);

      // Tests never reach a model, so grading fails the way an outage would, and says the same.
      await grading.release();

      const graded = page.waitForResponse(
        (response) => response.request().postData()?.includes(draft) ?? false,
      );

      await send.click();

      // The same text sent again keeps its id, so the server grades and records it once.
      const resent = await graded;
      expect(resent.request().postDataJSON()).toMatchObject({ attemptId });

      await expect(failed).toBeVisible();
      await expect(send).toBeEnabled();
      await expect(rewrite).toHaveValue(draft);

      // A rewrite the screen stopped waiting for is still being graded when the learner sends a
      // different one and then skips the rest: the block is finished only once both settled, so
      // it counts whatever they recorded, and nothing more is sent once it's being finished.
      const earlier = await holdPosts(page, isSubmission);
      await send.click();
      await page.clock.fastForward(91_000);
      await expect(failed).toBeVisible();
      earlier.stopHolding();

      const other = `${draft} Por fim, a escola deve acompanhar os resultados a cada semestre.`;
      await rewrite.fill(other);
      await expect(rewrite).toHaveValue(other);
      const otherGraded = page.waitForResponse((response) => isSubmission(response.request()));
      await send.click();
      await otherGraded;
      await expect(failed).toBeVisible();

      const order: string[] = [];

      page.on("request", (request) => {
        if (request.headers()["next-action"] && request.postData()?.includes(essay.blockId)) {
          order.push("finish");
        }
      });

      page.on("requestfailed", (request) => {
        if (isSubmission(request)) {
          order.push("settled");
        }
      });

      const skip = page.getByRole("button", { name: "Skip the rewrite" });
      await skip.click();
      await expect(skip).toBeDisabled();
      await expect(send).toBeDisabled();

      await earlier.release();
      await expect(page).not.toHaveURL(/\/essay\//u);
      expect(order.slice(0, 2)).toStrictEqual(["settled", "finish"]);
    });
  });

  test("an essay being written stays on the device, and leaving with it unsent asks first", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const essay = await addGradedEssay({ goalId: user.goalId, userId: user.id });
      const text = "Minha nova versão começa pela proposta de intervenção, com o agente e o meio.";

      await page.goto(`/essay/${essay.blockId}`);
      // The grade's steps are read once they show.
      await expect(stepDots(page)).toBeVisible();
      await nextStep(page);
      await page.getByRole("button", { exact: true, name: "Rewrite" }).click();

      const rewrite = page.getByLabel("Rewrite what needs work");

      // Rewrite mounted through React's action; its graded text and word count prove the writer is ready.
      const gradedText = await rewrite.inputValue();
      expect(gradedText).not.toBe("");

      await expect(
        page.getByText(`${gradedText.trim().split(/\s+/u).length} words`, { exact: true }),
      ).toBeVisible();

      await rewrite.fill(text);
      await expect(rewrite).toHaveValue(text);
      await expect(page.getByText("14 words", { exact: true })).toBeVisible();

      // A reload loses nothing: the text comes back on the next Rewrite.
      await page.reload();
      await expect(stepDots(page)).toBeVisible();
      await nextStep(page);
      await page.getByRole("button", { exact: true, name: "Rewrite" }).click();
      await expect(rewrite).toHaveValue(text);
      await expect(page.getByText("14 words", { exact: true })).toBeVisible();

      // Leaving with the text unsent asks first; keeping on writing keeps it.
      await page.getByRole("link", { name: "Leave" }).click();
      const leave = page.getByRole("alertdialog", { name: "Leave for now?" });
      await expect(leave).toBeVisible();
      await leave.getByRole("button", { name: "Keep writing" }).click();
      await expect(rewrite).toHaveValue(text);

      await page.getByRole("link", { name: "Leave" }).click();
      await leave.getByRole("button", { name: "Leave" }).click();
      await expect(page).not.toHaveURL(/\/essay\//u);

      await page.goto(`/essay/${essay.blockId}`);
      await expect(stepDots(page)).toBeVisible();
      await nextStep(page);
      await page.getByRole("button", { exact: true, name: "Rewrite" }).click();
      await expect(rewrite).toHaveValue(text);
      await expect(page.getByText("14 words", { exact: true })).toBeVisible();
    });
  });

  test("a language goal for a certificate moves to an exam goal, and onboarding to its page", async ({
    page,
  }) => {
    const goal = `english for my certificate ${randomUUID().slice(0, 8)}`;

    await goalUnderstandingFixture({
      goal,
      result: {
        followUps: [],
        goals: [
          {
            kind: "language",
            level: "A2",
            nativeLanguage: "pt",
            ownLevel: "basic",
            subject: "English",
            targetDate: `${new Date().getUTCFullYear() + 3}-03-31`,
            targetLanguage: "en",
            title: "Learn English",
          },
        ],
        route: "goals",
      },
      userId: await ensureGuest(page),
    });

    await page.goto("/start");
    await page.getByRole("textbox", { name: "I want to" }).fill(goal);
    await page.getByRole("button", { name: "Build my plan" }).click();
    await page.getByRole("button", { name: "Looks right" }).click();

    await expect(page.getByRole("heading", { name: "Why are you learning it?" })).toBeVisible();
    const languageGoal = await prisma.goal.findFirstOrThrow({ where: { prompt: goal } });
    await expect(page).toHaveURL(new RegExp(`/start/${languageGoal.id}$`, "u"));

    await page.getByRole("textbox", { name: "Why" }).fill("Vou fazer o IELTS em março");
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    // A language certificate reports a score: that's the target onboarding asks for.
    await expect(page.getByRole("heading", { name: "What score do you need?" })).toBeVisible();

    const examGoal = await prisma.goal.findFirstOrThrow({
      where: { details: { equals: languageGoal.id, path: ["movedFromGoalId"] } },
    });

    expect(examGoal).toMatchObject({ kind: "exam", status: "active", title: "IELTS" });
    await expect(page).toHaveURL(new RegExp(`/start/${examGoal.id}$`, "u"));

    // The URL is the exam goal's own: opening it again goes on where the learner is.
    await page.reload();

    await expect(page.getByRole("heading", { name: "What score do you need?" })).toBeVisible();
  });

  test("an essay with full marks on every competency has nothing left to work on", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const essay = await addGradedEssay({ fullMarks: true, goalId: user.goalId, userId: user.id });
      await page.goto(`/essay/${essay.blockId}`);

      // No competency stands out as the one to work on, and the next step says nothing is left.
      const scores = page.getByRole("list", { name: "Score by criterion" });
      await expect(scores.getByText("200 of 200", { exact: true })).toHaveCount(5);

      await nextStep(page);

      await expect(
        page.getByRole("heading", { level: 1, name: "Nothing left to work on" }),
      ).toBeVisible();

      await page.getByRole("button", { exact: true, name: "Rewrite" }).click();

      await expect(
        page.getByText("Every criterion has full marks in this estimate."),
      ).toBeVisible();

      await expect(page.getByText(/^Next step:/u)).toHaveCount(0);
    });
  });

  test("an AP free-response answer scored by its rows' points", async ({ browser }) => {
    const { blockId, user } = await createApFreeResponseDay();
    const page = await openAs(browser, user);

    await page.goto(`/essay/${blockId}`);

    await expect(
      page.getByRole("heading", { level: 1, name: /^Your answer\s*2–4$/u }),
    ).toBeVisible();

    const scores = page.getByRole("list", { name: "Score by criterion" });
    await expect(scores.getByText("(c) Explanation")).toBeVisible();
    await expectAccessibleScreen(page, "a graded free-response answer");

    await nextStep(page);
    await expect(page.getByRole("heading", { level: 1, name: "(c) Explanation" })).toBeVisible();

    await page.getByRole("button", { exact: true, name: "Rewrite" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Free response · AP scoring guidelines" }),
    ).toBeVisible();

    // A short situation is part of the question: it stays over the instruction, in the column.
    await expect(
      page.getByRole("main").getByText("A student measures an enzyme's rate at five temperatures."),
    ).toBeVisible();

    await expect(page.getByRole("complementary", { name: "Your last grade" })).toBeVisible();
    await page.context().close();
  });

  // From a laptop the instruction sat only in the aside, beside an empty box, cut off at 1180px and
  // 770px from the box at 2560px; the aside was named by the rubric, not by the texts it held.
  test("an essay's instruction sits over the box at every size, its motivating texts beside it on a laptop", async ({
    browser,
  }) => {
    const { blockId, user } = await createEnemEssayDay();
    const page = await openAs(browser, user);
    await page.goto(`/essay/${blockId}`);

    const box = page.getByLabel("Your essay");
    const texts = page.getByText(/^Em Teresina, Jussara/u);

    const instruction = page.getByRole("heading", {
      level: 2,
      name: new RegExp(`^${ENEM_INSTRUCTION.slice(0, 40)}`, "u"),
    });

    await expect(
      page.getByRole("heading", { level: 1, name: "Essay · ENEM rubric" }),
    ).toBeVisible();

    await expect(page.getByRole("complementary", { name: "Motivating texts" })).toBeVisible();
    await expect(instruction).toBeVisible();

    const [onLaptop, boxOnLaptop, textsOnLaptop] = await Promise.all([
      boxOf(instruction),
      boxOf(box),
      boxOf(texts),
    ]);

    expect(onLaptop.y + onLaptop.height).toBeLessThan(boxOnLaptop.y);
    expect(boxOnLaptop.x + boxOnLaptop.width).toBeLessThan(textsOnLaptop.x);
    expect(textsOnLaptop.y).toBeLessThan(boxOnLaptop.y);

    // A long essay scrolls inside the box, so the instruction with its theme and the word count
    // stay in view, on a short laptop window too: the box gives up its height first.
    await page.setViewportSize({ height: 600, width: 1180 });
    await box.fill(Array.from({ length: 40 }, () => "Uma linha do texto.").join("\n"));
    await expect(page.getByText(/^\d{2,} words$/u)).toBeInViewport({ ratio: 1 });
    await expect(instruction).toBeInViewport({ ratio: 1 });

    // On a phone the texts come first, then the instruction, then the box, as in the booklet.
    await page.setViewportSize({ height: 844, width: 390 });

    await expect(
      page.getByRole("main").getByText("Motivating texts", { exact: true }),
    ).toBeVisible();

    const [textsOnPhone, onPhone, boxOnPhone] = await Promise.all([
      boxOf(texts),
      boxOf(instruction),
      boxOf(box),
    ]);

    expect(textsOnPhone.y).toBeLessThan(onPhone.y);
    expect(onPhone.y).toBeLessThan(boxOnPhone.y);
    await page.context().close();
  });

  test("the SAT's estimate and result use its own scale", async ({ browser }) => {
    const { user } = await createSatExamAfterMock();
    const page = await openAs(browser, user);

    await page.goto("/exam");

    const score = page.getByLabel("Your total score (400 to 1600)");
    await expect(score).toHaveAttribute("step", "10");
    await score.fill("1350");
    await page.getByRole("button", { name: "Save my result" }).click();
    await expect(page.getByText("Result saved: 1350. Thank you for telling us.")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Result saved: 1350. Thank you for telling us.")).toBeVisible();

    // The estimate, on the exam's own scale, sits behind the Plan's number.
    await page.goto("/plan");
    await preparationNumber(page).click();

    await expect(
      page
        .getByRole("dialog", { name: "Your preparation" })
        .locator('[data-slot="estimated-score"]')
        .getByText("1170 to 1430", { exact: true }),
    ).toBeVisible();

    await page.context().close();
  });

  test("a Cebraspe exam's practice cites a past paper's statement, leaves statements blank and scores net", async ({
    browser,
  }) => {
    const { user } = await createNetScoredPracticeDay();
    const page = await openAs(browser, user);
    const feedback = page.getByRole("region", { name: "Answer feedback" });

    await page.goto("/session");
    await page.getByRole("button", { name: /^Start/u }).click();

    // True, right. A statement copied from a past paper cites it before and after it's answered.
    await expect(page.getByText(/^First statement/u)).toBeVisible();
    await expect(page.getByText(`Past exam question · ${QUOTED_STATEMENT_CITATION}`)).toBeVisible();

    await expect(
      page.getByText("A wrong answer cancels a right one. Not sure? Leave it blank."),
    ).toBeVisible();

    // Statements are judged right or wrong, as the exam prints them, never true or false.
    await expect(page.getByRole("radio", { name: /^True/u })).toBeHidden();
    await page.getByRole("radio", { name: /^Right/u }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await expect(feedback.getByText(QUOTED_STATEMENT_CITATION)).toBeVisible();
    await expect(page.getByText("net 1")).toBeVisible();
    await page.keyboard.press("Enter");

    // Left blank: it cancels nothing, reads as left blank (not as a mistake) and isn't saved as one.
    await expect(page.getByText(/^Second statement/u)).toBeVisible();
    await page.getByRole("radio", { name: "Leave blank" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect(feedback.getByText("Left blank")).toBeVisible();
    await expect(feedback.getByText("Not quite")).toBeHidden();
    await expect(feedback.getByText(/Saved to your mistakes/u)).toBeHidden();
    await expect(page.getByText("0 wrong")).toBeVisible();
    await expect(page.getByText("net 1")).toBeVisible();

    // Coming back to the block still counts the blank as neither.
    await page.reload();
    await expect(page.getByText(/^Third statement/u)).toBeVisible();
    await expect(page.getByText("0 wrong")).toBeVisible();
    await expect(page.getByText("net 1")).toBeVisible();

    // Wrong on a right statement: the net drops back to zero, and the options show the right
    // answer beside the pick.
    await page.getByRole("radio", { name: /^Wrong/u }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect(page.getByRole("radio", { name: /^Right.*Correct$/u })).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Wrong.*Your answer$/u })).toBeVisible();
    await expect(page.getByText("net 0")).toBeVisible();
    await page.keyboard.press("Enter");

    // The day's only block ends on the summary, led by the net score.
    await expect(page.getByRole("heading", { level: 1, name: /^Done in /u })).toBeVisible();
    await expect(page.getByText("net 0", { exact: true })).toBeVisible();
    await page.context().close();
  });
});
