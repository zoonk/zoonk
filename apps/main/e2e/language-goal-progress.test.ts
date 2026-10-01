import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";
import { createLanguageLearner } from "./language-learner";
import { asPersona } from "./learn-personas";
import { openAs } from "./study-day";

const RENTING_UNIT = "Alugando um apartamento";

const TOEFL_SCENARIO = {
  character: { name: "Sarah", place: "Test centre", role: "examinadora" },
  characterBrief: "Listen and Repeat in the library, then four interview questions.",
  exam: "toefl",
  hints: ["One reason is that...", "For example..."],
  objectives: [
    { description: "Repita cada frase exatamente.", label: "Listen and Repeat" },
    { description: "Responda às quatro perguntas.", label: "Take an Interview" },
  ],
  openingLine: "Hello, I'm Sarah. First, listen to each sentence and repeat it exactly.",
  situation: "Um simulado curto da seção Speaking do TOEFL iBT, em cerca de cinco minutos.",
  title: "Simulado de Speaking do TOEFL",
};

const criterion = (name: string, [bandLow, bandHigh]: [number, number], evidence: string) => ({
  bandHigh,
  bandLow,
  criterion: name,
  evidence,
  tip: `Dica para ${name}.`,
});

const TOEFL_FEEDBACK = {
  criteria: [
    criterion("repetition", [4, 4.5], 'Você disse "clean it" em vez de "clean it up".'),
    criterion("elaboration", [3.5, 4], "Suas respostas ficaram curtas."),
    criterion("grammar", [4, 4.5], 'Um erro: "since the first semester".'),
    criterion("vocabulary", [4, 4.5], 'Boas escolhas como "sustainable".'),
    criterion("delivery", [3.5, 4.5], "A transcrição não mostra como você soou."),
  ],
  exam: "toefl",
  focus: "elaboration",
  kind: "speakingMock",
  overall: { bandHigh: 4.5, bandLow: 4 },
};

/**
 * A TOEFL speaking mock at the goal's A2, the level the learner speaks at with no speaking level
 * yet: written ahead and not opened, or finished with its feedback.
 */
async function createToeflMock({
  finished,
  goalId,
  userId,
}: {
  finished: boolean;
  goalId: string;
  userId: string;
}) {
  return prisma.languageConversation.create({
    data: {
      goalId,
      kind: "speakingMock",
      language: "pt",
      level: "A2",
      liveModel: "openai/gpt-live-1",
      minutes: 5,
      scenario: TOEFL_SCENARIO,
      targetLanguage: "en",
      titleSnapshot: TOEFL_SCENARIO.title,
      userId,
      ...(finished
        ? {
            endedAt: new Date(),
            feedback: TOEFL_FEEDBACK,
            objectivesMet: ["Listen and Repeat", "Take an Interview"],
            spokenSeconds: 240,
            status: "completed",
          }
        : {}),
    },
  });
}

/**
 * Marcos's English goal (a language goal) on Progress: level by skill against his target, "I can
 * already…", the words he knows and the last four weeks. Progress keeps the sections every goal
 * shares and leaves preparation out. A goal preparing for the TOEFL gets its speaking mock: before
 * the call, the header names the TOEFL and the objectives are its two tasks; after it, an
 * estimated band on TOEFL's 1 to 6 scale, overall and for each TOEFL criterion, with the focus
 * marked.
 */
test.describe("Language goal progress", () => {
  test(`Progress shows level by skill, "I can already" and the last four weeks, and the exam screen keeps the speaking mock once the goal moved to the IELTS`, async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page, user }) => {
      await page.goto("/progress");

      const levels = page.getByRole("list", { name: "Level by skill" });

      await expect(levels.getByRole("listitem")).toHaveText([
        /^Reading\s*B1$/u,
        /^Listening\s*B1/u,
        /^Speaking\s*A2\+/u,
        /^Writing\s*A2\+/u,
      ]);

      await expect(
        levels
          .getByRole("listitem")
          .filter({ hasText: "Listening" })
          .getByLabel("up since the level test"),
      ).toBeVisible();

      await expect(page.getByText(/^Goal B1\+ by \w+ \d{4}$/u)).toBeVisible();
      await expect(page.getByText("Listening went up to B1 since the level test.")).toBeVisible();

      const canDo = page.getByRole("region", { name: "I can already…" });
      await expect(canDo.getByText("Consigo pedir informações no aeroporto")).toBeVisible();
      await expect(canDo.getByText("Consigo marcar uma visita, not yet")).toBeVisible();

      await expect(page.getByText(/^9\s*words known$/u)).toBeVisible();

      const recent = page.getByRole("region", { name: "In the last 4 weeks" });
      await expect(recent).toContainText("9new words");
      await expect(recent).toContainText("1conversation");

      const situation = page.getByRole("region", { name: "Your current situation" });
      await expect(situation.getByText("Unit 2 of 6")).toBeVisible();
      await expect(situation.getByRole("link", { name: RENTING_UNIT })).toBeVisible();

      await expect(page.getByRole("link", { name: /Mistakes notebook/u })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Your stats" })).toBeVisible();
      await expectAccessibleScreen(page, "Progress for a language goal");
      await expect(page.getByText(/preparation$/u)).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "IELTS speaking mock" })).toHaveCount(0);

      await prisma.goal.update({
        data: { kind: "exam", title: "IELTS" },
        where: { id: user.goalId },
      });

      await page.goto("/exam");

      await expect(page.getByRole("heading", { name: "IELTS speaking mock" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Start the mock" })).toBeEnabled();
    });
  });

  test("Progress offers the TOEFL speaking mock in Fun, which opens with its two tasks and ends with a band on the 1 to 6 scale", async ({
    browser,
  }) => {
    const { goal, user } = await createLanguageLearner("fun");

    const [waiting] = await Promise.all([
      createToeflMock({ finished: false, goalId: goal.id, userId: user.id }),
      prisma.goal.update({
        data: { prompt: "I need English for grad school and the TOEFL in May" },
        where: { id: goal.id },
      }),
    ]);

    const page = await openAs(browser, user);
    await page.goto("/progress");

    await expect(page.getByRole("heading", { name: "TOEFL speaking mock" })).toBeVisible();

    await expect(
      page.getByText(/^Repeat sentences, then a short interview with an examiner/u),
    ).toBeVisible();

    await expectAccessibleScreen(page, "Progress for a language goal");

    await expect(page.getByRole("heading", { name: "IELTS speaking mock" })).toHaveCount(0);

    // The mock written ahead opens at once.
    await page.getByRole("button", { name: "Start the mock" }).click();

    await expect(page).toHaveURL(new RegExp(`/conversation/${waiting.id}$`, "u"));
    await expect(page.getByText("TOEFL speaking mock").first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Sarah" })).toBeVisible();
    await expect(page.getByText("Listen and Repeat", { exact: true })).toBeVisible();
    await expect(page.getByText("Take an Interview", { exact: true })).toBeVisible();

    const finished = await createToeflMock({ finished: true, goalId: goal.id, userId: user.id });
    await page.goto(`/conversation/${finished.id}`);

    await expect(page.getByText("TOEFL speaking mock").first()).toBeVisible();
    await expect(page.getByText("4.0–4.5", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Estimated band, from 1 to 6")).toBeVisible();

    await expect(
      page.getByText("An estimate from one short mock, not an official score."),
    ).toBeVisible();

    const criteria = page.getByRole("listitem");

    await expect(criteria.getByRole("heading")).toHaveText([
      "Repeating sentences",
      /^Clear, developed answers\s*Focus$/u,
      "Grammar",
      "Vocabulary",
      "Pace and pronunciation",
    ]);

    await expect(page.getByText('Você disse "clean it" em vez de "clean it up".')).toBeVisible();

    await expect(page.getByRole("button", { name: "Try another mock" })).toBeEnabled();

    await page.getByRole("link", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/progress$/u);
    await page.context().close();
  });
});
