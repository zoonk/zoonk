import { prisma } from "@zoonk/db";
import { createAnytimeMockLearner } from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { CHARACTER_REPLY, answerLiveCalls } from "./live-peer";
import { openAs } from "./study-day";

const TASK_ONE = "Tarea 1: Valorar propuestas y conversar sobre ellas";

const CARD = {
  instructions: [
    "Lea el problema y las propuestas, y valore al menos cuatro de ellas.",
    "Después, converse con el entrevistador sobre el tema.",
  ],
  photos: [],
  prompts: [
    "Crear más carriles bici en el centro",
    "Cerrar el centro a los coches los domingos",
    "Abaratar el transporte público",
  ],
  summary: "Avalie as propostas para melhorar o trânsito e depois converse com a examinadora.",
  table: null,
  text: null,
};

/** DELE B2's first task as its card writer leaves it: Lucía examines, the card is on the table. */
const SCENARIO = {
  character: { name: "Lucía", place: "Sala de examen", role: "examinadora" },
  characterBrief:
    "Give the instruction, listen for 3 to 4 minutes, then ask which proposal is best.",
  examTask: { card: CARD, exam: "dele", level: "B2", task: "t1" },
  hints: ["Desde mi punto de vista…", "Por un lado…", "Me parece que…"],
  objectives: [{ description: CARD.summary, label: TASK_ONE }],
  openingLine: "Buenos días. Puede empezar cuando quiera.",
  situation: CARD.summary,
  title: TASK_ONE,
};

async function createDeleLearner({ plus }: { plus: boolean }) {
  const learner = await createAnytimeMockLearner({ plus });

  await prisma.goal.update({
    data: { targetLanguage: "es", title: "DELE B2" },
    where: { id: learner.goal.id },
  });

  return learner;
}

function createTaskOne({ goalId, userId }: { goalId: string; userId: string }) {
  return prisma.languageConversation.create({
    data: {
      goalId,
      kind: "examSpeaking",
      language: "en",
      level: "B2",
      liveModel: "openai/gpt-live-1",
      minutes: 7,
      scenario: SCENARIO,
      targetLanguage: "es",
      titleSnapshot: TASK_ONE,
      userId,
    },
  });
}

test.describe("Exam speaking tasks", () => {
  test("a Plus learner opens an exam task, completes its call and continues to the next task", async ({
    browser,
  }) => {
    const { goal, user } = await createDeleLearner({ plus: true });
    const waiting = await createTaskOne({ goalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);

    await answerLiveCalls(page, "answers");
    await page.goto("/exam");
    const speaking = page.getByRole("region", { name: "Speaking" });
    await speaking.getByRole("button", { name: new RegExp(TASK_ONE, "u") }).click();
    await speaking.getByRole("button", { name: "Start this task" }).click();
    await expect(page).toHaveURL(new RegExp(`/conversation/${waiting.id}\\?from=exam$`, "u"));

    await page.getByRole("button", { name: "Start the call" }).click();
    const transcript = page.getByRole("log", { name: "Conversation" });
    await expect(transcript.getByText("Hi! Are you calling about the apartment?")).toBeVisible();
    await expect(page.getByRole("region", { name: "Your card" })).toBeVisible();

    await page
      .getByRole("textbox", { name: "Type your reply" })
      .fill("Creo que la mejor es la primera.");

    await page.keyboard.press("Enter");
    await expect(transcript.getByText(CHARACTER_REPLY)).toBeVisible();
    await page.getByRole("button", { exact: true, name: "End" }).click();

    await expect(page.getByRole("heading", { name: "This task has no estimate" })).toBeVisible();

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: waiting.id } }),
    ).resolves.toMatchObject({ objectivesMet: [TASK_ONE], status: "completed" });

    await page.getByRole("link", { name: "Go to task 2" }).click();
    await expect(page).toHaveURL(/\/exam\?task=t2$/u);
    // The exam page the router kept opens the task the link asks for, ready to start.
    await expect(page.getByRole("button", { name: /Tarea 2: Describir/u })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await expect(page.getByRole("button", { name: "Start this task" })).toBeEnabled();

    await expect(
      prisma.languageConversation.count({ where: { goalId: goal.id, kind: "examSpeaking" } }),
    ).resolves.toBe(1);

    await page.context().close();
  });
});
