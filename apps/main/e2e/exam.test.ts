import { type Browser, type Request, type Route } from "@playwright/test";
import { addGradedEssay, addTodayMock, createEnemEssayDay, playMock } from "./exam-fixtures";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { nextStep, stepDots } from "./result-steps";
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

/**
 * An ENEM learner whose essay in today's session is graded once, on a page of their own. Its
 * theme fits in one line, so the last grade has the aside to itself.
 */
async function withGradedEssay(
  browser: Browser,
  run: (learner: { essay: { blockId: string }; page: Page }) => Promise<void>,
) {
  const { goalId, user } = await createEnemEssayDay();

  const [essay, page] = await Promise.all([
    addGradedEssay({ goalId, userId: user.id }),
    openAs(browser, user),
  ]);

  try {
    await run({ essay, page });
  } finally {
    await page.context().close();
  }
}

test.describe("Exam goal", () => {
  test("a mock in real conditions, its start and hand-in waits bounded, and its result", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const mock = await addTodayMock({ goalId: user.goalId, userId: user.id });

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

      // Handing in is confirmed first; the retry goes through.
      await page.getByRole("button", { name: "Hand in the mock exam" }).click();

      await page
        .getByRole("alertdialog", { name: "Hand in the mock exam?" })
        .getByRole("button", { name: "Hand in" })
        .click();

      // The score is a range: an estimate.
      await expect(
        page.getByRole("heading", { level: 1, name: /^Mock exam 2 done\s*\d+–\d+$/u }),
      ).toBeVisible();
    });
  });

  test("an essay graded by the official rubric, with a rewrite that keeps its text when grading is slow or fails", async ({
    browser,
  }) => {
    await withGradedEssay(browser, async ({ essay, page }) => {
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

      // The grade first, then its next step, then rewriting the draft.
      await expect(
        page.getByRole("heading", { level: 1, name: /^Your essay\s*660–740$/u }),
      ).toBeVisible();

      await nextStep(page);
      await page.getByRole("button", { exact: true, name: "Rewrite" }).click();

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
      await expect(page).not.toHaveURL(new RegExp(`/essay/${essay.blockId}`, "u"));
      expect(order.slice(0, 2)).toStrictEqual(["settled", "finish"]);
    });
  });

  test("an essay being written stays on the device, and leaving with it unsent asks first", async ({
    browser,
  }) => {
    await withGradedEssay(browser, async ({ essay, page }) => {
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
});
