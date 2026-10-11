import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { createAnytimeMockLearner } from "./anytime-mock-fixtures";
import { type Page, expect, test } from "./fixtures";
import { createLanguageLearner } from "./language-learner";
import { CHARACTER_REPLY, answerLiveCalls } from "./live-gateway";
import { nextStep } from "./result-steps";
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

const grade = (criterion: string, [bandLow, bandHigh]: [number, number], evidence: string) => ({
  bandHigh,
  bandLow,
  criterion,
  evidence,
  tip: `Dica de ${criterion}.`,
});

const FEEDBACK = {
  brief: false,
  criteria: [
    grade("coherence", [2, 2], "Você ligou as ideias com «por un lado» e «sin embargo»."),
    grade("fluency", [1, 2], "A transcrição não mostra como você soou."),
    grade("accuracy", [2, 3], "Um erro: «si tendría tiempo»."),
    grade("range", [1, 1], "Você repetiu «bueno» e «bien» em todas as propostas."),
    grade("holistic", [2, 2], "Cumpriu a tarefa com clareza."),
  ],
  focus: "range",
  heard: true,
  kind: "examSpeaking",
};

/**
 * A DELE B2 candidate's exam goal: an exam learner whose goal names DELE B2 and is in Spanish,
 * on Plus unless `plus` is false.
 */
async function createDeleLearner({ plus }: { plus: boolean }) {
  const learner = await createAnytimeMockLearner({ plus });

  await prisma.goal.update({
    data: { targetLanguage: "es", title: "DELE B2" },
    where: { id: learner.goal.id },
  });

  return learner;
}

/** DELE B2's first task, written ahead (not opened yet), or finished with its estimate. */
function createTaskOne({
  feedback = FEEDBACK,
  finished,
  goalId,
  userId,
}: {
  feedback?: typeof FEEDBACK;
  finished: boolean;
  goalId: string;
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
      scenario: SCENARIO,
      targetLanguage: "es",
      titleSnapshot: TASK_ONE,
      userId,
      ...(finished
        ? {
            endedAt: new Date(),
            feedback,
            objectivesMet: [TASK_ONE],
            spokenSeconds: 380,
            startedAt: new Date(),
            status: "completed",
          }
        : {}),
    },
  });
}

/** The paper's tasks in order under their official names, with the exam's own timing. */
async function expectDeleTasks(page: Page) {
  const speaking = page.getByRole("region", { name: "Speaking" });

  await expect(speaking.getByText("DELE B2", { exact: true })).toBeVisible();

  await expect(speaking.getByRole("listitem")).toHaveText([
    // The exam's 20 minutes of preparation cover Tasks 1 and 2 together.
    new RegExp(
      `^1${TASK_ONE}With an examiner \\(AI\\) · 6–7 min · 20 min to prepare tasks 1 and 2`,
      "u",
    ),
    /^2Tarea 2: Describir una situación imaginada .*With an examiner \(AI\) · 5–6 min · 20 min to prepare tasks 1 and 2/u,
    /^3Tarea 3: Opinar sobre los datos de una encuestaWith an examiner \(AI\) · 3–4 min/u,
  ]);

  return speaking;
}

/**
 * DELE, DELF, Goethe and Cambridge goals practice their speaking paper task by task on the call:
 * the exam page (and a language goal's level sheet) lists the tasks with the exam's timing; a task
 * opens on its card with the preparation time, says an AI stands in for the examiner, keeps the
 * card in sight through the call, and ends with an estimate on each official criterion that never
 * reads as an official score. Free learners see it all locked.
 */
test.describe("Exam speaking tasks", () => {
  test("a Plus learner practices DELE B2's first task from the exam page: its card, the preparation time, the call with the card in sight", async ({
    browser,
  }) => {
    const { goal, user } = await createDeleLearner({ plus: true });
    const waiting = await createTaskOne({ finished: false, goalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);

    // The call's stand-in answers WebSockets the page opens after it loads with the route.
    await answerLiveCalls(page, "answers");
    await page.goto("/exam");
    const speaking = await expectDeleTasks(page);

    await expect(
      speaking.getByText(/^An AI stands in for the human examiner\. Each try/u),
    ).toBeVisible();

    await expect(speaking.getByText("Available with Plus")).toHaveCount(0);

    // A task opens in place with what it's rated on; a card written ahead and never called opens
    // at once, without writing another.
    await speaking.getByRole("button", { name: new RegExp(TASK_ONE, "u") }).click();
    const taskOne = speaking.getByRole("listitem").first();

    await expect(
      taskOne.getByText(
        "Rated on Coherence, Fluency, Accuracy, Range of language, and Overall impression.",
      ),
    ).toBeVisible();

    await taskOne.getByRole("button", { name: "Start this task" }).click();
    await expect(page).toHaveURL(new RegExp(`/conversation/${waiting.id}\\?from=exam$`, "u"));

    await expect(page.getByText("DELE B2 · Task 1 of 3")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: TASK_ONE })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: TASK_ONE })).toBeFocused();
    // The exam room is every task's place, so only who plays whom is said.
    await expect(page.getByText("Lucía · examiner", { exact: true })).toBeVisible();
    await expect(page.getByText(/Sala de examen/u)).toHaveCount(0);

    await expect(
      page.getByText(
        "Lucía opens the call, and your card stays on screen. Rated on Coherence, Fluency, Accuracy, Range of language, and Overall impression.",
      ),
    ).toBeVisible();

    await expect(page.getByText("6–7 min", { exact: true })).toBeVisible();

    await expect(
      page.getByText(
        "Lucía is an AI standing in for a human examiner. It's practice: the estimate after it isn't an official score.",
      ),
    ).toBeVisible();

    const card = page.getByRole("region", { name: "Your card" });
    await expect(card.getByText(CARD.instructions[0] ?? "")).toBeVisible();
    await expect(card.getByRole("listitem")).toHaveText(CARD.prompts);

    // The exam's preparation runs on its own clock; nothing is charged before the call.
    await expect(
      page.getByText(
        "The exam gives 20 min to prepare tasks 1 and 2 together, about 10 for this one.",
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: "Start preparing" }).click();
    await expect(page.getByRole("timer")).toContainText(/^Preparing: (?:10:00|9:5\d) left/u);
    await expect(page.getByRole("timer")).toBeFocused();

    // The clock keeps running through a reload (a locked phone, a slip of the finger).
    await page.reload();
    await expect(page.getByRole("timer")).toContainText(/^Preparing: 9:[45]\d left/u);
    await expect(page.getByRole("button", { name: "Start again" })).toBeVisible();
    await expectAccessibleScreen(page, "an exam task's card");

    await page.getByRole("button", { name: "Start the call" }).click();

    const transcript = page.getByRole("log", { name: "Conversation" });
    await expect(transcript.getByText("Hi! Are you calling about the apartment?")).toBeVisible();
    await expect(page.getByText("examiner", { exact: true })).toBeVisible();
    await expect(page.getByText(/Sala de examen/u)).toHaveCount(0);

    // The card stays in sight through the call, where a unit's call shows its goals.
    await expect(page.getByRole("region", { name: "Your card" }).getByRole("listitem")).toHaveText(
      CARD.prompts,
    );

    await expect(page.getByRole("list", { name: "Goals of the call" })).toHaveCount(0);
    await expect(page.getByText(/^0:0\d \/ 7:00$/u)).toBeVisible();

    await page
      .getByRole("textbox", { name: "Type your reply" })
      .fill("Creo que la mejor es la primera.");

    await page.keyboard.press("Enter");
    await expect(transcript.getByText(CHARACTER_REPLY)).toBeVisible();

    await page.getByRole("button", { exact: true, name: "End" }).click();

    // No model grades in tests: the task ends with no estimate, and leads on to the next task.
    await expect(page.getByRole("heading", { name: "This task has no estimate" })).toBeVisible();

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: waiting.id } }),
    ).resolves.toMatchObject({ objectivesMet: [TASK_ONE], status: "completed" });

    // "Next" opens the paper's next task in its list, written only once the learner starts it,
    // and the finished one keeps its last try and its result.
    await page.getByRole("link", { name: "Go to task 2" }).click();
    await expect(page).toHaveURL(/\/exam\?task=t2$/u);

    const taskTwo = page.getByRole("button", { name: /Tarea 2: Describir/u });
    await expect(taskTwo).toBeFocused();
    await expect(page.getByRole("button", { name: "Start this task" })).toBeVisible();

    const finishedRow = page
      .getByRole("region", { name: "Speaking" })
      .getByRole("listitem")
      .first();

    await expect(finishedRow).toContainText("Last try: no estimate");
    await finishedRow.getByRole("button", { name: new RegExp(TASK_ONE, "u") }).click();

    await expect(finishedRow.getByRole("link", { name: "See your last result" })).toHaveAttribute(
      "href",
      `/conversation/${waiting.id}?from=exam`,
    );

    await expect(
      prisma.languageConversation.count({ where: { goalId: goal.id, kind: "examSpeaking" } }),
    ).resolves.toBe(1);

    await page.context().close();
  });

  test("a finished task shows each official criterion on DELE's 0 to 3 scale, then the one to work on first", async ({
    browser,
  }) => {
    const { goal, user } = await createDeleLearner({ plus: true });
    const finished = await createTaskOne({ finished: true, goalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);

    await page.goto(`/conversation/${finished.id}?from=exam`);

    await expect(page.getByText("DELE B2 · Task 1 of 3")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: TASK_ONE })).toBeVisible();

    await expect(page.getByText("On these scales, 2 is the B2 level.")).toBeVisible();

    // The learner's word for each criterion, its official name, the estimate on the official
    // scale, and where it stands against the exam's level (band 2), the focus marked too.
    await expect(page.getByRole("listitem")).toHaveText([
      /^Coherence\s*Coherencia\s*2 of 3\s*At B2$/u,
      /^Fluency\s*Fluidez\s*1–2 of 3\s*Near B2$/u,
      /^Accuracy\s*Corrección\s*2–3 of 3\s*At B2$/u,
      /^Range of language\s*Alcance\s*1 of 3\s*Below B2\s*Focus$/u,
      /^Overall impression\s*Escala holística\s*2 of 3\s*At B2$/u,
    ]);

    await expect(
      page.getByText(
        "An estimate from one practice task, not an official score. How you sound is rated by how easy you are to understand, never by your accent.",
      ),
    ).toBeVisible();

    await expect(page.getByText(/You typed|You said little/u)).toHaveCount(0);

    await expectAccessibleScreen(page, "an exam task's estimate");

    await nextStep(page);
    await expect(page.getByText("Work on this first")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Range of language" })).toBeVisible();

    await expect(
      page.getByText("Você repetiu «bueno» e «bien» em todas as propostas."),
    ).toBeVisible();

    await expect(page.getByText("Dica de range.")).toBeVisible();

    await page.getByRole("button", { name: "See every criterion" }).click();

    const criteria = page.getByRole("dialog", { name: "By criterion" });
    await expect(criteria.getByText("Um erro: «si tendría tiempo».")).toBeVisible();

    // The keyboard stays in the sheet until it closes, past its last link too.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(criteria.locator(":focus")).toHaveCount(1);

    await page.keyboard.press("Escape");

    // Another try writes a new card of the same task; the way on opens the paper's next task.
    await expect(page.getByRole("button", { name: "Try this task with a new card" })).toBeEnabled();

    await expect(page.getByRole("link", { name: "Go to task 2" })).toHaveAttribute(
      "href",
      "/exam?task=t2",
    );

    await page.context().close();
  });

  test("a typed, brief task says so once, leaves fluency unrated and never grades how the learner sounds", async ({
    browser,
  }) => {
    const { goal, user } = await createDeleLearner({ plus: true });

    const finished = await createTaskOne({
      feedback: {
        ...FEEDBACK,
        brief: true,
        criteria: FEEDBACK.criteria.filter((item) => item.criterion !== "fluency"),
        heard: false,
      },
      finished: true,
      goalId: goal.id,
      userId: user.id,
    });

    const page = await openAs(browser, user);
    await page.goto(`/conversation/${finished.id}?from=exam`);

    await expect(
      page.getByText("You typed your replies, so this estimate leaves out how you sound."),
    ).toHaveCount(1);

    await expect(
      page.getByText(
        "You said little in this task, so there wasn't much to judge. A longer try gives a closer estimate.",
      ),
    ).toHaveCount(1);

    await expect(page.getByRole("listitem").nth(1)).toHaveText(/^Fluency\s*Fluidez\s*Not rated$/u);

    await expect(
      page.getByText("An estimate from one practice task, not an official score.", { exact: true }),
    ).toBeVisible();

    await page.context().close();
  });

  test("a task that needs more call time than today has left waits, with nothing written, and says so", async ({
    browser,
  }) => {
    const { goal, user } = await createDeleLearner({ plus: true });

    // 18 of Plus's 20 minutes are used today: a short practice call still fits, no DELE B2 task does.
    await usageRecordsFixture({ count: 1, kind: "conversation", seconds: 1080, userId: user.id });

    const page = await openAs(browser, user);
    await page.goto("/exam");
    const speaking = await expectDeleTasks(page);

    await speaking.getByRole("button", { name: /Tarea 2: Describir/u }).click();
    await speaking.getByRole("button", { name: "Start this task" }).click();

    const alert = speaking.getByRole("alert");
    await expect(alert).toContainText("Not enough call time today for this task");
    await expect(alert).toContainText("Your calls come back tomorrow.");
    await expect(page).toHaveURL(/\/exam$/u);

    await expect(
      prisma.languageConversation.count({ where: { goalId: goal.id, kind: "examSpeaking" } }),
    ).resolves.toBe(0);

    await page.context().close();
  });

  test("free learners see the paper's tasks locked on the exam page, and Plus's way back returns there", async ({
    browser,
  }) => {
    const dele = await createDeleLearner({ plus: false });
    const page = await openAs(browser, dele.user);
    await page.goto("/exam");
    const speaking = await expectDeleTasks(page);

    await expect(
      speaking.getByRole("listitem").filter({ hasText: "Available with Plus" }),
    ).toHaveCount(3);

    // A locked task opens in place all the same, with what it's rated on and nothing to start.
    await speaking.getByRole("button", { name: new RegExp(TASK_ONE, "u") }).click();

    await expect(
      speaking.getByText(
        "Rated on Coherence, Fluency, Accuracy, Range of language, and Overall impression.",
      ),
    ).toBeVisible();

    await expect(speaking.getByRole("button", { name: "Start this task" })).toHaveCount(0);

    await expect(
      speaking.getByText(
        "Speaking practice comes with Plus: every task of the paper on a call, and an estimate on the official criteria after each one.",
      ),
    ).toBeVisible();

    // Plus opens from here and its way back returns here, not to the settings it sits under.
    await speaking.getByRole("link", { name: "See Plus" }).click();
    await expect(page).toHaveURL(/\/subscription$/u);
    await page.getByRole("link", { exact: true, name: "Back" }).click();
    await expect(page).toHaveURL(/\/exam$/u);

    await page.context().close();
  });

  test("a language goal naming no exam practices its language's paper at its target from Today and its level sheet", async ({
    browser,
  }) => {
    // Aiming at B1+ in English with no exam named: Cambridge's B1 Preliminary, exam-style.
    const { user } = await createLanguageLearner();

    const page = await openAs(browser, user);
    await page.goto("/today");

    const practice = page.getByRole("region", { name: "Practice anytime" });
    const entry = practice.getByRole("link", { name: /Exam-style speaking/u });
    await expect(entry).toContainText("B1 Preliminary tasks on a call");
    await expect(entry).toContainText("Available with Plus");

    await entry.click();
    await expect(page).toHaveURL(/\/speaking$/u);
    await expect(page.getByRole("heading", { level: 1, name: "B1 Preliminary" })).toBeVisible();

    await expect(
      page.getByText(
        "B1 Preliminary is an official exam. Practice its speaking tasks whether or not you plan to take it.",
      ),
    ).toBeVisible();

    const paper = page.getByRole("region", { name: "Tasks" });
    await expect(paper.getByText("Part 3: Collaborative task")).toBeVisible();
    await expect(paper.getByText(/^With another candidate \(AI\) · 3–4 min$/u)).toBeVisible();

    await expect(
      paper.getByRole("listitem").filter({ hasText: "Available with Plus" }),
    ).toHaveCount(4);

    // The level sheet leads to the same page.
    await page.goto("/journey");
    await page.getByRole("button", { name: /^Your level/u }).click();

    await expect(
      page
        .getByRole("dialog", { name: "Your level" })
        .getByRole("link", { name: /Exam-style speaking/u }),
    ).toHaveAttribute("href", "/speaking");

    await page.context().close();
  });
});
