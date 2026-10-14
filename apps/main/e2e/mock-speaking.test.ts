import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
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

/** A task graded from typed replies: nothing on fluency, which only the voice shows. */
const TYPED_FEEDBACK = {
  brief: false,
  criteria: ["coherence", "accuracy", "range", "holistic"].map((criterion) => ({
    bandHigh: 2,
    bandLow: 2,
    criterion,
    evidence: "Você escreveu «crear más carriles bici».",
    tip: "Use «sin embargo».",
  })),
  focus: "range",
  heard: false,
  kind: "examSpeaking",
};

/** A task's call, written when the learner started the speaking section, done or still to do. */
function taskCall({
  done,
  feedback,
  goalId,
  name,
  sectionId,
  task,
  userId,
}: {
  done: boolean;
  feedback: typeof TYPED_FEEDBACK | null;
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
        ? {
            endedAt: new Date(),
            ...(feedback ? { feedback } : {}),
            spokenSeconds: feedback?.heard === false ? 0 : 380,
            startedAt: new Date(),
            status: "completed",
          }
        : {}),
    },
  });
}

/**
 * A DELE B2 learner on Plus whose full mock reached its speaking section and started its paper:
 * the first `done` tasks' calls are done (graded with `feedback`, if any), the others wait.
 */
async function createSpeakingMock({
  done = 1,
  feedback = null,
}: { done?: number; feedback?: typeof TYPED_FEEDBACK | null } = {}) {
  const { goal, user } = await createAnytimeMockLearner({ plus: true });
  const sectionId = randomUUID();

  await prisma.goal.update({
    data: { targetLanguage: "es", title: "DELE B2" },
    where: { id: goal.id },
  });

  const calls = await Promise.all(
    TASKS.map(({ name, task }, index) =>
      taskCall({
        done: index < done,
        feedback,
        goalId: goal.id,
        name,
        sectionId,
        task,
        userId: user.id,
      }),
    ),
  );

  const mock = await prisma.mockExam.create({
    data: {
      conditions: {
        day: null,
        fullLength: true,
        purpose: "practice",
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
  test("lists the paper's tasks to call in turn, and handing in early says the paper gets no estimate", async ({
    browser,
  }) => {
    const { calls, mock, user } = await createSpeakingMock();
    const page = await openAs(browser, user);

    await page.goto(`/mock/${mock.id}`);
    await expect(page.getByRole("heading", { level: 2, name: SPEAKING })).toBeVisible();

    const tasks = page.getByRole("listitem");

    await expect(tasks).toHaveCount(3);
    await expect(tasks.nth(0)).toContainText("Done");

    // Each task left opens its call, which comes back to the mock.
    await expect(tasks.nth(1).getByRole("link", { name: "Start" })).toHaveAttribute(
      "href",
      new RegExp(`/conversation/${calls[1]?.id}\\?mock=${mock.id}$`, "u"),
    );

    await expect(page.getByText(/2 tasks left\.$/u)).toBeVisible();

    await page.getByRole("button", { name: "Hand in the mock exam" }).click();
    const confirm = page.getByRole("alertdialog");

    await expect(
      confirm.getByText(/^2 tasks aren't done, so this paper gets no estimate/u),
    ).toBeVisible();

    await confirm.getByRole("button", { name: "Hand in" }).click();

    // A day that is all spoken has no questions to score: its paper is the result.
    await expect(page.getByRole("heading", { level: 1, name: "No estimate" })).toBeVisible();
    await expect(page.getByText(/^Mock exam 1 done/u)).toBeHidden();

    await expect(
      page.getByText("Not every task was done, so there's no estimate for this paper."),
    ).toBeVisible();

    await expect(
      page.getByText("The exam asks for at least 30 of 50 on this paper and listening together."),
    ).toBeVisible();

    // Now that the mock is over, the done task's feedback opens, and leads back to the mock.
    const rows = page.getByRole("list", { name: "Tasks" }).getByRole("listitem");

    await expect(rows.nth(1)).toContainText("Not done");

    await expect(rows.nth(0).getByRole("link", { name: "See feedback" })).toHaveAttribute(
      "href",
      new RegExp(`/conversation/${calls[0]?.id}\\?mock=${mock.id}$`, "u"),
    );
  });

  test("a task's call goes back to the mock when it ends, with its feedback and missions said after the mock", async ({
    browser,
  }) => {
    const { calls, goal, mock, user } = await createSpeakingMock();

    await studySessionFixture({
      goalId: goal.id,
      missions: { picks: [{ anchor: {}, kind: "call", total: 1 }], version: 1 },
      userId: user.id,
    });

    const page = await openAs(browser, user);

    const peer = await answerLiveCalls(page, "answers");
    await page.goto(`/mock/${mock.id}`);
    await page.getByRole("listitem").nth(1).getByRole("link", { name: "Start" }).click();
    await expect(page).toHaveURL(new RegExp(`/conversation/${calls[1]?.id}\\?mock=`, "u"));

    await page.getByRole("button", { name: "Start the call" }).click();
    await page.getByRole("textbox", { name: "Type your reply" }).fill("Me parece una buena idea.");
    await page.keyboard.press("Enter");
    const transcript = page.getByRole("log", { name: "Conversation" });
    await expect(transcript.getByText(CHARACTER_REPLY)).toBeVisible();

    // Speaking in it makes the call count as the day's last mission.
    await peer.emit({
      delta: " Creo que es la mejor propuesta.",
      end_ms: 3000,
      start_ms: 1000,
      type: "session.input_transcript.delta",
    });

    await expect(transcript.getByText("Creo que es la mejor propuesta.")).toBeVisible();
    await page.getByRole("button", { exact: true, name: "End" }).click();

    // No feedback mid-mock, as on exam day: the saved call opens the mock again.
    await expect(page).toHaveURL(new RegExp(`/mock/${mock.id}$`, "u"));
    await expect(page.getByText(/1 task left\.$/u)).toBeVisible();
    await expect(page.getByRole("listitem").nth(1)).toContainText("Done");
    const moment = page.locator("[data-slot=mission-moment]");
    await expect(moment).toHaveCount(0);

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: calls[1]?.id } }),
    ).resolves.toMatchObject({ status: "completed" });

    // Once the mock is over, its result says what the call did to the day's missions, read from
    // what the call's end recorded, so a reload says it too.
    await page.getByRole("button", { name: "Hand in the mock exam" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

    const expectCallMission = async () => {
      await expect(page.getByRole("heading", { level: 1, name: "No estimate" })).toBeVisible();
      await expect(moment).toContainText("Mission done: Have a call");
      await expect(moment.getByRole("button", { name: "+50 Brain Power" })).toBeVisible();
      await expect(moment).toContainText("from today's missions");
    };

    await expectCallMission();
    await page.reload();
    await expectCallMission();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ height: 844, width: 390 });

    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: test.info().outputPath("full-mock-call-mission-390.png"),
    });

    await page.setViewportSize({ height: 900, width: 1440 });

    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: test.info().outputPath("full-mock-call-mission-1440.png"),
    });

    await page.context().close();
  });

  test("a paper answered by typing says why it has no estimate", async ({ browser }) => {
    const { mock, user } = await createSpeakingMock({ done: 3, feedback: TYPED_FEEDBACK });
    const page = await openAs(browser, user);

    await page.goto(`/mock/${mock.id}`);
    const done = page.getByText("Every task is done. Hand in this section to go on.");

    await expect(done).toBeVisible();
    await expect(page.getByRole("button", { name: "Hand in the mock exam" })).toBeEnabled();
    await page.keyboard.press("Enter");
    const confirm = page.getByRole("alertdialog", { name: "Hand in the mock exam?" });

    await expect(
      confirm.getByText("Every task is done. After this, you can't do them again in this mock."),
    ).toBeVisible();

    await confirm.getByRole("button", { name: "Keep going" }).click();
    await expect(done).toBeVisible();
    await page.getByRole("button", { name: "Hand in the mock exam" }).click();
    await confirm.getByRole("button", { name: "Hand in" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "No estimate" })).toBeVisible();

    await expect(
      page.getByText(
        "You typed in at least one task, and typing shows nothing of how you sound, so the speaking part has no estimate. Speak every task next time to get one.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "See feedback" })).toHaveCount(3);
    await page.context().close();
  });
});
