import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { MODES, asPersona } from "./learn-personas";

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
      level: "B1",
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
 * A TOEFL speaking mock, in both modes: before the call, the header names the TOEFL and the
 * objectives are its two tasks; after it, an estimated band on TOEFL's 1 to 6 scale, overall and
 * for each TOEFL criterion, with the focus marked.
 */
test.describe("TOEFL speaking mock", () => {
  for (const mode of MODES) {
    test(`opens with the TOEFL's two tasks in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "language" }, async ({ page, user }) => {
        const mock = await createToeflMock({
          finished: false,
          goalId: user.goalId,
          userId: user.id,
        });

        await page.goto(`/conversation/${mock.id}`);

        await expect(page.getByText("TOEFL speaking mock").first()).toBeVisible();
        await expect(page.getByRole("heading", { level: 1, name: "Sarah" })).toBeVisible();
        await expect(page.getByText("Listen and Repeat", { exact: true })).toBeVisible();
        await expect(page.getByText("Take an Interview", { exact: true })).toBeVisible();
      });
    });

    test(`shows the estimated band on the 1 to 6 scale by TOEFL criteria in ${mode}`, async ({
      browser,
    }) => {
      await asPersona(browser, { mode, persona: "language" }, async ({ page, user }) => {
        const mock = await createToeflMock({
          finished: true,
          goalId: user.goalId,
          userId: user.id,
        });

        await page.goto(`/conversation/${mock.id}`);

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

        await expect(
          page.getByText('Você disse "clean it" em vez de "clean it up".'),
        ).toBeVisible();

        await expect(page.getByRole("button", { name: "Try another mock" })).toBeEnabled();

        await page.getByRole("link", { name: "Continue" }).click();
        await expect(page).toHaveURL(/\/progress$/u);
      });
    });
  }
});
