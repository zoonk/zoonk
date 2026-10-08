import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { type Page, expect, test } from "./fixtures";
import { createLanguageLearner } from "./language-learner";
import { asPersona } from "./learn-personas";
import { nextStep } from "./result-steps";
import { openAs } from "./study-day";

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

/** The Journey's hero opens the level sheet. */
async function openLevel(page: Page) {
  await page.goto("/journey");
  await page.getByRole("button", { name: /^Your level/u }).click();
  return page.getByRole("dialog", { name: "Your level" });
}

/**
 * Marcos's English goal (a language goal) on the Journey: its hero is his level against his
 * target, and its sheet has level by skill with every rise named and "I can already…". The
 * mistakes notebook it links to offers the pattern noticed in his mistakes. Preparation stays out.
 * A goal preparing for the TOEFL gets its speaking mock in that sheet: before the call, the header
 * names the TOEFL and the objectives are its two tasks; after it, an estimated band on TOEFL's 1
 * to 6 scale, overall and for each TOEFL criterion, with the focus marked.
 */
test.describe("Language goal progress", () => {
  test(`the Journey shows his level by skill, "I can already" and his mistakes, and the exam screen keeps the speaking mock once the goal moved to the IELTS`, async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const sheet = await openLevel(page);
      const levels = sheet.getByRole("list", { name: "Level by skill" });

      await expect(levels.getByRole("listitem")).toHaveText([
        /^Reading\s*B1$/u,
        /^Listening\s*B1/u,
        /^Speaking\s*A2\+/u,
        /^Writing\s*A2\+/u,
      ]);

      await expect(sheet.getByText(/^Goal B1\+ by \w+ \d{4}$/u)).toBeVisible();

      // The sentence names every skill with an up arrow, the biggest rise first.
      await expect(
        sheet.getByText("Listening, Speaking, and Writing went up since the level test."),
      ).toBeVisible();

      await Promise.all(
        ["Listening", "Speaking", "Writing"].map((skill) =>
          expect(
            levels
              .getByRole("listitem")
              .filter({ hasText: skill })
              .getByLabel("up since the level test"),
          ).toBeVisible(),
        ),
      );

      await expect(
        levels
          .getByRole("listitem")
          .filter({ hasText: "Reading" })
          .getByLabel(/since the level test$/u),
      ).toHaveCount(0);

      const canDo = sheet.getByRole("region", { name: "I can already…" });
      await expect(canDo.getByText("Consigo pedir informações no aeroporto")).toBeVisible();
      // Only the next thing he's working toward, not the rest of the unit.
      await expect(
        canDo.getByText("Consigo perguntar o preço do aluguel e as regras, not yet"),
      ).toBeVisible();

      await expect(canDo.getByText(/Consigo marcar uma visita/u)).toHaveCount(0);

      // A language goal has no exam, so no speaking mock.
      await expect(sheet.getByRole("heading", { name: "IELTS speaking mock" })).toHaveCount(0);
      await expectAccessibleScreen(page, "the level of a language goal");

      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(page.getByText("Your preparation")).toHaveCount(0);

      // The notebook, one of Today's "Practice anytime", offers the pattern noticed in his recent
      // mistakes.
      await page.goto("/today");

      await page
        .getByRole("region", { name: "Practice anytime" })
        .getByRole("link", { name: /^Mistakes notebook\b.*\b1 to fix$/u })
        .click();

      const pattern = await prisma.mistakePattern.findFirstOrThrow({ where: { userId: user.id } });

      await expect(
        page.getByRole("link", { name: "We noticed a pattern “Since” e “for”" }),
      ).toHaveAttribute("href", `/pattern/${pattern.id}`);

      await prisma.goal.update({
        data: { kind: "exam", title: "IELTS" },
        where: { id: user.goalId },
      });

      await page.goto("/exam");

      await expect(page.getByRole("heading", { name: "IELTS speaking mock" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Start the mock" })).toBeEnabled();
    });
  });

  test("the level sheet offers the TOEFL speaking mock, which opens with its two tasks and ends with a band on the 1 to 6 scale", async ({
    browser,
  }) => {
    const { goal, user } = await createLanguageLearner();

    const [waiting] = await Promise.all([
      createToeflMock({ finished: false, goalId: goal.id, userId: user.id }),
      prisma.goal.update({
        data: { prompt: "I need English for grad school and the TOEFL in May" },
        where: { id: goal.id },
      }),
    ]);

    const page = await openAs(browser, user);
    const sheet = await openLevel(page);

    await expect(sheet.getByRole("heading", { name: "TOEFL speaking mock" })).toBeVisible();

    await expect(
      sheet.getByText(/^Repeat sentences, then a short interview with an examiner/u),
    ).toBeVisible();

    await expect(sheet.getByRole("heading", { name: "IELTS speaking mock" })).toHaveCount(0);

    // The mock written ahead opens at once.
    await sheet.getByRole("button", { name: "Start the mock" }).click();

    await expect(page).toHaveURL(new RegExp(`/conversation/${waiting.id}$`, "u"));
    await expect(page.getByText("TOEFL speaking mock").first()).toBeVisible();
    await expect(page.getByText("Sarah · examinadora · Test centre")).toBeVisible();
    await expect(page.getByText("Listen and Repeat", { exact: true })).toBeVisible();
    await expect(page.getByText("Take an Interview", { exact: true })).toBeVisible();

    const finished = await createToeflMock({ finished: true, goalId: goal.id, userId: user.id });
    await page.goto(`/conversation/${finished.id}`);

    // The result in steps: the band overall on the TOEFL's scale, each criterion, then the one to
    // work on first.
    await expect(
      page.getByRole("heading", { level: 1, name: /^TOEFL speaking mock\s*4\.0–4\.5$/u }),
    ).toBeVisible();

    await expect(page.getByText("Estimated band, from 1 to 6")).toBeVisible();

    await expect(
      page.getByText("An estimate from one short mock, not an official score."),
    ).toBeVisible();

    await nextStep(page);

    await expect(page.getByRole("listitem")).toHaveText([
      /^Repeating sentences\s*4\.0–4\.5$/u,
      /^Clear, developed answers\s*Focus\s*3\.5–4\.0$/u,
      /^Grammar\s*4\.0–4\.5$/u,
      /^Vocabulary\s*4\.0–4\.5$/u,
      /^Pace and pronunciation\s*3\.5–4\.5$/u,
    ]);

    await nextStep(page);
    await expect(page.getByText("Work on this first")).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 1, name: "Clear, developed answers" }),
    ).toBeVisible();

    await expect(page.getByText("Suas respostas ficaram curtas.")).toBeVisible();
    await expect(page.getByText("Dica para elaboration.")).toBeVisible();

    // Every criterion's comments wait behind a link; another try is one tap away.
    await page.getByRole("button", { name: "See every criterion" }).click();

    await expect(
      page
        .getByRole("dialog", { name: "By criterion" })
        .getByText('Você disse "clean it" em vez de "clean it up".'),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Try another mock" })).toBeEnabled();

    await page.getByRole("link", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/journey$/u);
    await page.context().close();
  });
});
