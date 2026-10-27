import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { createAnytimeMockLearner } from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { CHARACTER_REPLY, answerLiveCalls } from "./live-peer";
import { openAs } from "./study-day";

const SPEAKING = "Prueba 4: Expresión e interacción orales";

/** DELE B2's three tasks as their card writer leaves them, under the names the paper gives them. */
const TASKS = [
  { name: "Tarea 1: Valorar propuestas y conversar sobre ellas", task: "t1" },
  { name: "Tarea 2: Describir una situación imaginada a partir de una fotografía", task: "t2" },
  { name: "Tarea 3: Opinar sobre los datos de una encuesta", task: "t3" },
];

const CARD = {
  instructions: ["Lea las propuestas y valore al menos cuatro de ellas."],
  photos: [],
  prompts: ["Crear más carriles bici"],
  summary: "Avalie as propostas e converse com a examinadora.",
  table: null,
  text: null,
};

/** A task's call, written when the learner started the speaking section, done or still to do. */
function taskCall({
  done,
  goalId,
  name,
  sectionId,
  task,
  userId,
}: {
  done: boolean;
  goalId: string;
  name: string;
  sectionId: string;
  task: string;
  userId: string;
}) {
  return prisma.languageConversation.create({
    data: {
      goalId,
      kind: "examSpeaking",
      language: "en",
      level: "B2",
      liveModel: "openai/gpt-live-1",
      minutes: 7,
      scenario: {
        character: { name: "Lucía", place: "Sala de examen", role: "examinadora" },
        characterBrief: "Give the instruction and listen.",
        examTask: { card: CARD, exam: "dele", level: "B2", task },
        hints: [],
        objectives: [{ description: CARD.summary, label: name }],
        openingLine: "Buenos días.",
        situation: CARD.summary,
        title: name,
      },
      sectionId,
      targetLanguage: "es",
      titleSnapshot: name,
      userId,
      ...(done
        ? { endedAt: new Date(), spokenSeconds: 380, startedAt: new Date(), status: "completed" }
        : {}),
    },
  });
}

/**
 * A DELE B2 learner on Plus whose full mock reached its speaking section and started its paper:
 * the first task's call is done and the others wait.
 */
async function createSpeakingMock() {
  const { goal, user } = await createAnytimeMockLearner({ plus: true });
  const sectionId = randomUUID();

  await prisma.goal.update({
    data: { targetLanguage: "es", title: "DELE B2" },
    where: { id: goal.id },
  });

  const calls = await Promise.all(
    TASKS.map(({ name, task }, index) =>
      taskCall({ done: index < 1, goalId: goal.id, name, sectionId, task, userId: user.id }),
    ),
  );

  const mock = await prisma.mockExam.create({
    data: {
      conditions: {
        day: null,
        examQuestions: null,
        fullLength: true,
        partialCredit: "allOrNothing",
        purpose: "practice",
        reused: 0,
        scoring: "raw",
        sections: [
          {
            essays: [],
            itemIds: [],
            kind: "speaking",
            minutes: 40,
            name: SPEAKING,
            questions: 0,
            routing: null,
            speakingSectionId: sectionId,
          },
        ],
        shape: { area: null, day: null, kind: "full" },
        startTime: null,
        timeZone: null,
        timedOutSections: [],
        wrongPenalty: 1,
      },
      goalId: goal.id,
      sectionStartedAt: new Date(),
      startedAt: new Date(),
      userId: user.id,
    },
  });

  return { calls, goal, mock, user };
}

test.describe("Mock speaking sections", () => {
  test("a task's call saves its completion and returns to the mock for hand-in", async ({
    browser,
  }) => {
    const { calls, mock, user } = await createSpeakingMock();

    const page = await openAs(browser, user);

    await answerLiveCalls(page, "answers");
    await page.goto(`/mock/${mock.id}`);
    await page.getByRole("listitem").nth(1).getByRole("link", { name: "Start" }).click();
    await expect(page).toHaveURL(new RegExp(`/conversation/${calls[1]?.id}\\?mock=`, "u"));

    await page.getByRole("button", { name: "Start the call" }).click();
    await page.getByRole("textbox", { name: "Type your reply" }).fill("Me parece una buena idea.");
    await page.keyboard.press("Enter");
    const transcript = page.getByRole("log", { name: "Conversation" });
    await expect(transcript.getByText(CHARACTER_REPLY)).toBeVisible();

    await page.getByRole("button", { exact: true, name: "End" }).click();

    // No feedback mid-mock, as on exam day: the saved call opens the mock again.
    await expect(page).toHaveURL(new RegExp(`/mock/${mock.id}$`, "u"));
    await expect(page.getByText(/1 task left\.$/u)).toBeVisible();
    await expect(page.getByRole("listitem").nth(1)).toContainText("Done");

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: calls[1]?.id } }),
    ).resolves.toMatchObject({ status: "completed" });

    await page.getByRole("button", { name: "Hand in the mock exam" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "No estimate" })).toBeVisible();
    await page.context().close();
  });
});
