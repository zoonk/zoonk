import { checkConversationObjectives } from "@zoonk/ai/tasks/v2/language/conversation-objectives";
import { generateExamSpeakingCard } from "@zoonk/ai/tasks/v2/language/exam-speaking-card";
import { drawExamSpeakingPhoto } from "@zoonk/ai/tasks/v2/language/exam-speaking-photo";
import { createLiveCallSession } from "@zoonk/ai/tasks/v2/language/live-call-session";
import { scoreSpeaking } from "@zoonk/ai/tasks/v2/language/speaking-score";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import {
  cleanupTestCalls,
  connectTestCall,
  setupTestCalls,
  testCallCompletionInput,
} from "../../_test-utils/connect-test-call";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import { reviewRunsInline } from "../../_test-utils/review-runs";
import { completeLanguageConversation } from "../conversations/complete-language-conversation";
import { getLanguageConversation } from "../conversations/get-language-conversation";
import { startLanguageConversation } from "../conversations/start-language-conversation";
import { loadSpeakingPaper } from "./_utils/exam-speaking-setup";
import { getSpeakingSection } from "./get-speaking-section";
import { startSpeakingSection } from "./start-speaking-section";

const PROVENANCE = {
  generatedAt: new Date().toISOString(),
  latencyMs: 1,
  model: "openai/gpt-6-luna",
  promptVersion: "v-test",
  provider: "openai",
  requestedModel: "openai/gpt-6-luna",
  runId: "run-test",
  usage: {},
};

const PHOTO_URL = "https://blob.test/library/speaking/photo.webp";

/** What the card writer returns, with the material a task asks for. */
function writtenCard({ photos = 0 }: { photos?: number } = {}) {
  return {
    character: { name: "Lucía", place: "Sala de examen", role: "examinadora" },
    characterBrief: "Give the instruction, listen, then ask which proposal is best.",
    hints: ["Desde mi punto de vista…", "Por un lado…", "Me parece que…"],
    instructions: ["Lea las propuestas y valore al menos cuatro."],
    openingLine: "Buenos días. Puede empezar cuando quiera.",
    photos: Array.from({ length: photos }, (_, index) => ({
      alt: `Foto ${index + 1}`,
      scene: `A family at a train station, photo ${index + 1}`,
    })),
    prompts: ["Crear más carriles bici", "Cerrar el centro a los coches"],
    summary: "Valore as propostas e depois converse com a examinadora.",
    table: null,
    text: null,
  };
}

const TURNS = [
  { speaker: "character" as const, text: "Buenos días. Puede empezar cuando quiera." },
  { speaker: "learner" as const, text: "Creo que la mejor propuesta es crear más carriles bici." },
];

const COMPLETION = {
  spokenSeconds: 200,
  timeZone: "America/Sao_Paulo",
  turns: TURNS,
  usedHelp: false,
};

/** Every criterion it's asked for, at one band. */
function gradeAt(band: number) {
  return vi
    .mocked(scoreSpeaking)
    .mockImplementation(async ({ criteria }) => ({
      data: {
        brief: false,
        criteria: criteria.map((criterion) => ({
          bandHigh: band,
          bandLow: band,
          criterion: criterion.key,
          evidence: "Você disse «crear más carriles bici».",
          tip: "Use «sin embargo».",
        })),
        focus: criteria[0]?.key ?? "",
        heard: true,
      },
      provenance: PROVENANCE,
      systemPrompt: "",
      usage: undefined as never,
      userPrompt: "",
    }));
}

/** A Portuguese speaker preparing for DELE B2, on Plus unless `plus` is false. */
async function deleLearner({ plus = true, title = "DELE B2" } = {}) {
  const user = await userFixture();

  const [goal] = await Promise.all([
    goalFixture({
      details: { examName: "DELE", reason: "Preciso do DELE B2 para o mestrado" },
      kind: "exam",
      language: "pt",
      prompt: "Passar no DELE B2",
      targetLanguage: "es",
      title,
      userId: user.id,
    }),
    plus
      ? prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
        })
      : null,
  ]);

  mockSession(user.id);
  return { goal, user };
}

async function startTask({ goalId, task }: { goalId: string; task: string }) {
  const started = await startLanguageConversation({ goalId, kind: "examSpeaking", task });

  if (started.status !== "ready") {
    throw new Error(`Couldn't start: ${started.status}`);
  }

  return started.conversationId;
}

/** Starts an actual provider session through the public reserve and SDP boundaries. */
async function connect(conversationId: string) {
  await connectTestCall(conversationId);
}

async function readView(conversationId: string) {
  const result = await getLanguageConversation(conversationId);

  if (result.status !== "ready") {
    throw new Error("Expected the conversation");
  }

  return result.conversation;
}

describe("exam speaking tasks", () => {
  beforeEach(async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    await setupTestCalls();

    const photo = await sharp({
      create: { background: "#88aacc", channels: 3, height: 4, width: 6 },
    })
      .png()
      .toBuffer();

    vi.mocked(generateExamSpeakingCard).mockImplementation(async ({ task }) => ({
      data: writtenCard({ photos: task.stimulus === "photos" ? 1 : 0 }),
      provenance: PROVENANCE,
      systemPrompt: "",
      usage: undefined as never,
      userPrompt: "",
    }));

    vi.mocked(drawExamSpeakingPhoto).mockResolvedValue({
      data: { image: { base64: "", mediaType: "image/png", uint8Array: new Uint8Array(photo) } },
      provenance: PROVENANCE,
    } as never);

    storeBlobUploads({ url: PHOTO_URL });
    gradeAt(2);
  });

  afterEach(cleanupTestCalls);

  it("marks a new exam task once and leaves its waiting retry unchanged", async () => {
    const { goal } = await deleLearner();
    const conversationId = await startTask({ goalId: goal.id, task: "t1" });

    await expect(startTask({ goalId: goal.id, task: "t1" })).resolves.toBe(conversationId);
  });

  it("starts a DELE B2 task with its card, the AI as its examiner and the exam's own timing", async () => {
    const { goal } = await deleLearner();
    const conversationId = await startTask({ goalId: goal.id, task: "t1" });
    const view = await readView(conversationId);

    expect(view).toMatchObject({
      kind: "examSpeaking",
      // The call runs to the task's official 7 minutes.
      minutes: 7,
      targetLanguage: "es",
    });

    expect(view.examTask).toMatchObject({
      card: { instructions: ["Lea las propuestas y valore al menos cuatro."], photos: [] },
      exam: "dele",
      level: "B2",
      nextTask: "t2",
      number: 1,
      sectionId: null,
      task: {
        minutes: { max: 7, min: 6 },
        name: "Tarea 1: Valorar propuestas y conversar sobre ellas",
        options: 2,
        // The exam's 20 minutes prepare Tasks 1 and 2 together (B2 guide and Modelo 0): half each.
        prepMinutes: 10,
        prepShared: { minutes: 20, tasks: [1, 2] },
        role: "examiner",
      },
      taskCount: 3,
      title: "DELE B2",
    });

    expect(view.examTask?.criteria.map((criterion) => criterion.key)).toStrictEqual([
      "coherence",
      "fluency",
      "accuracy",
      "range",
      "holistic",
    ]);

    // The examiner keeps time like a real one: the conversation starts after the monologue.
    expect(view.examTask?.cues.map((cue) => cue.atSeconds)).toStrictEqual([240]);
    await connect(conversationId);

    // Only the server tells the voice model its role, when it creates the session.
    expect(createLiveCallSession).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining("one task of the DELE B2 speaking paper"),
      }),
    );

    expect(generateExamSpeakingCard).toHaveBeenCalledWith(
      expect.objectContaining({ exam: "dele", level: "B2", previous: null, title: "DELE B2" }),
    );
  });

  it("starts a task of a language goal that names no exam on its language's paper at its target", async () => {
    const user = await userFixture();

    const [goal] = await Promise.all([
      goalFixture({
        details: { targetLevel: "B1+" },
        kind: "language",
        language: "pt",
        prompt: "Quero conversar em francês com a família do meu marido",
        targetLanguage: "fr",
        title: "Francês com a família",
        userId: user.id,
      }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
    ]);

    mockSession(user.id);
    const view = await readView(await startTask({ goalId: goal.id, task: "p1" }));

    expect(view.examTask).toMatchObject({ exam: "delf", level: "B1", number: 1, title: "DELF B1" });
  });

  it("draws a photo task's photos once and keeps them with its card", async () => {
    const { goal } = await deleLearner();
    const view = await readView(await startTask({ goalId: goal.id, task: "t2" }));

    expect(view.examTask?.card.photos).toStrictEqual([{ alt: "Foto 1", url: PHOTO_URL }]);

    expect(drawExamSpeakingPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ scene: "A family at a train station, photo 1" }),
    );
  });

  it("comes with Plus: the free plan writes nothing and is told so", async () => {
    const { goal, user } = await deleLearner({ plus: false });

    await expect(
      startLanguageConversation({ goalId: goal.id, kind: "examSpeaking", task: "t1" }),
    ).resolves.toStrictEqual({ status: "plusRequired" });

    expect(generateExamSpeakingCard).not.toHaveBeenCalled();

    await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(
      0,
    );
  });

  it("waits, unwritten, when the call time left today can't fit the task's official length", async () => {
    freezeClock();

    const { goal, user } = await deleLearner();

    // 15 of Plus's 20 minutes today are used: DELE B2's Task 1 needs at least 6.
    await usageRecordsFixture({ count: 1, kind: "conversation", seconds: 900, userId: user.id });

    await expect(
      startLanguageConversation({ goalId: goal.id, kind: "examSpeaking", task: "t1" }),
    ).resolves.toMatchObject({ limit: { period: "day", tier: "plus" }, status: "limitReached" });

    expect(generateExamSpeakingCard).not.toHaveBeenCalled();

    // Task 3 takes 3 to 4 minutes, which still fit.
    await expect(startTask({ goalId: goal.id, task: "t3" })).resolves.toStrictEqual(
      expect.any(String),
    );
  });

  it("refuses a task the paper doesn't have and a goal for another exam", async () => {
    const { goal } = await deleLearner();

    await expect(
      startLanguageConversation({ goalId: goal.id, kind: "examSpeaking", task: "t9" }),
    ).resolves.toStrictEqual({ status: "notFound" });

    const ielts = await goalFixture({
      kind: "exam",
      language: "pt",
      targetLanguage: "en",
      title: "IELTS",
      userId: goal.userId,
    });

    await expect(
      startLanguageConversation({ goalId: ielts.id, kind: "examSpeaking", task: "t1" }),
    ).resolves.toStrictEqual({ status: "notLanguage" });
  });

  it("grades a finished task on the exam's criteria for that task, with no objective check", async () => {
    const { goal, user } = await deleLearner();
    const conversationId = await startTask({ goalId: goal.id, task: "t3" });
    await connect(conversationId);

    const completed = await completeLanguageConversation({
      conversationId,
      input: testCallCompletionInput(conversationId, COMPLETION),
      runs: reviewRunsInline,
    });

    expect(completed.status).toBe("completed");

    expect(scoreSpeaking).toHaveBeenCalledWith(
      expect.objectContaining({
        exam: "dele",
        learnerLanguage: "pt",
        level: "B2",
        spokenSeconds: 200,
        task: expect.objectContaining({
          minutes: { max: 4, min: 3 },
          name: "Tarea 3: Opinar sobre los datos de una encuesta",
        }),
        title: "DELE B2",
        turns: TURNS,
      }),
    );

    expect(checkConversationObjectives).not.toHaveBeenCalled();

    const row = await prisma.languageConversation.findUniqueOrThrow({
      where: { id: conversationId },
    });

    expect(row).toMatchObject({
      feedback: {
        criteria: expect.arrayContaining([
          expect.objectContaining({ bandHigh: 2, bandLow: 2, criterion: "coherence" }),
        ]),
        focus: "coherence",
        heard: true,
        kind: "examSpeaking",
      },
      objectivesMet: ["Tarea 3: Opinar sobre los datos de una encuesta"],
      status: "completed",
    });

    // The ledger counts it as a mock, like the IELTS and TOEFL speaking mock.
    await expect(
      prisma.learningEvent.findFirst({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ kind: "mock", seconds: 200 });
  });

  it("lists each task's last finished try with its estimates at the level, to open its result again", async () => {
    const { goal } = await deleLearner();

    const first = await startTask({ goalId: goal.id, task: "t3" });
    await connect(first);

    await completeLanguageConversation({
      conversationId: first,
      input: testCallCompletionInput(first, COMPLETION),
      runs: reviewRunsInline,
    });

    // The first try ended earlier; the second one, below the level on every criterion, is the last.
    await prisma.languageConversation.update({
      data: { endedAt: new Date(Date.now() - 60_000) },
      where: { id: first },
    });

    gradeAt(1);
    const second = await startTask({ goalId: goal.id, task: "t3" });
    await connect(second);

    await completeLanguageConversation({
      conversationId: second,
      input: testCallCompletionInput(second, COMPLETION),
      runs: reviewRunsInline,
    });

    const paper = await loadSpeakingPaper({ access: "open", goal });
    const byKey = new Map(paper?.tasks.map((task) => [task.key, task]));

    expect(byKey.get("t3")).toMatchObject({
      criteria: [
        { key: "coherence", name: "Coherencia" },
        { key: "fluency", name: "Fluidez" },
        { key: "accuracy", name: "Corrección" },
        { key: "range", name: "Alcance" },
        { key: "holistic", name: "Escala holística" },
      ],
      lastTry: { atLevel: 0, conversationId: second, nearLevel: 0, rated: 5 },
    });

    expect(byKey.get("t1")?.lastTry).toBeNull();
  });

  it("takes a card the learner opened and never called instead of writing another", async () => {
    const { goal } = await deleLearner();
    const first = await startTask({ goalId: goal.id, task: "t1" });

    await expect(startTask({ goalId: goal.id, task: "t1" })).resolves.toBe(first);
    expect(generateExamSpeakingCard).toHaveBeenCalledOnce();

    // Once called, the next try gets a fresh card, and another task never takes this one.
    await connect(first);

    const [again, other] = await Promise.all([
      startTask({ goalId: goal.id, task: "t1" }),
      startTask({ goalId: goal.id, task: "t3" }),
    ]);

    expect(new Set([first, again, other]).size).toBe(3);
  });

  it("counts a graded task as speaking evidence at the exam's level, by its criteria", async () => {
    const { goal, user } = await deleLearner();
    // Band 2 is DELE's level: four criteria at it, the holistic one below.
    vi.mocked(scoreSpeaking).mockImplementation(async ({ criteria }) => ({
      data: {
        brief: false,
        criteria: criteria.map((criterion) => ({
          bandHigh: criterion.key === "holistic" ? 1 : 2,
          bandLow: criterion.key === "holistic" ? 1 : 2,
          criterion: criterion.key,
          evidence: "",
          tip: "",
        })),
        focus: "holistic",
        heard: true,
      },
      provenance: PROVENANCE,
      systemPrompt: "",
      usage: undefined as never,
      userPrompt: "",
    }));

    const conversationId = await startTask({ goalId: goal.id, task: "t1" });
    await connect(conversationId);

    await completeLanguageConversation({
      conversationId,
      input: testCallCompletionInput(conversationId, COMPLETION),
      runs: reviewRunsInline,
    });

    await expect(
      prisma.languageSkillLevel.findFirst({
        where: { language: "es", skill: "speaking", userId: user.id },
      }),
    ).resolves.toMatchObject({ windowCorrect: 4, windowTotal: 5 });
  });

  it("starts a whole paper as one section and adds up its official points once every task is graded", async () => {
    const { goal } = await deleLearner();
    const started = await startSpeakingSection({ goalId: goal.id });

    if (started.status !== "ready") {
      throw new Error(`Couldn't start: ${started.status}`);
    }

    const { section } = started;

    expect(section).toMatchObject({
      estimate: { complete: false, high: null, low: null, total: 25 },
      exam: "dele",
      level: "B2",
      pass: { kind: "group", min: 30, of: 50 },
      prepMinutes: 20,
      prepTasks: ["t1", "t2"],
    });

    expect(section.tasks.map((task) => [task.key, task.status])).toStrictEqual([
      ["t1", "ready"],
      ["t2", "ready"],
      ["t3", "ready"],
    ]);

    for (const task of section.tasks) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- One learner can hold only one active voice session.
      await connect(task.conversationId);

      // oxlint-disable-next-line eslint/no-await-in-loop -- Finish this task before reserving the next learner session.
      await completeLanguageConversation({
        conversationId: task.conversationId,
        input: testCallCompletionInput(task.conversationId, COMPLETION),
        runs: reviewRunsInline,
      });
    }

    const finished = await getSpeakingSection(section.id);

    // Band 2 everywhere is two thirds of 25.
    expect(finished).toMatchObject({
      section: { estimate: { complete: true, total: 25, typed: false } },
      status: "ready",
    });

    expect(finished.status === "ready" && finished.section.estimate.low).toBeCloseTo(16.67, 2);

    const view = await readView(section.tasks[0]?.conversationId ?? "");
    expect(view.examTask?.sectionId).toBe(section.id);
  });

  it("says when a typed task leaves the paper without points: typing shows nothing of the voice", async () => {
    const { goal } = await deleLearner();
    const started = await startSpeakingSection({ goalId: goal.id });

    if (started.status !== "ready") {
      throw new Error(`Couldn't start: ${started.status}`);
    }

    // Typed replies are graded only on what words show (as the grader does with no speech).
    vi.mocked(scoreSpeaking).mockImplementation(async ({ criteria }) => ({
      data: {
        brief: false,
        criteria: criteria
          .filter((criterion) => !criterion.voiceOnly)
          .map((criterion) => ({
            bandHigh: 2,
            bandLow: 2,
            criterion: criterion.key,
            evidence: "Você escreveu «crear más carriles bici».",
            tip: "Use «sin embargo».",
          })),
        focus: criteria[0]?.key ?? "",
        heard: false,
      },
      provenance: PROVENANCE,
      systemPrompt: "",
      usage: undefined as never,
      userPrompt: "",
    }));

    for (const task of started.section.tasks) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- One learner can hold only one active voice session.
      await connect(task.conversationId);

      // oxlint-disable-next-line eslint/no-await-in-loop -- Finish this task before reserving the next learner session.
      await completeLanguageConversation({
        conversationId: task.conversationId,
        input: testCallCompletionInput(task.conversationId, { ...COMPLETION, spokenSeconds: 0 }),
        runs: reviewRunsInline,
      });
    }

    await expect(getSpeakingSection(started.section.id)).resolves.toMatchObject({
      section: { estimate: { complete: false, high: null, low: null, typed: true } },
      status: "ready",
    });
  });

  it("writes a task that continues an earlier one from that task's card", async () => {
    const { goal } = await deleLearner({ title: "DELE B1" });
    const started = await startSpeakingSection({ goalId: goal.id });

    expect(started.status).toBe("ready");

    // Task 2 talks about Task 1's topic and Task 4 role-plays Task 3's photo.
    expect(generateExamSpeakingCard).toHaveBeenCalledWith(
      expect.objectContaining({
        previous: expect.objectContaining({ task: "Tarea 1: Realizar una presentación breve" }),
        task: expect.objectContaining({ name: "Tarea 2: Participar en una conversación" }),
      }),
    );

    expect(generateExamSpeakingCard).toHaveBeenCalledWith(
      expect.objectContaining({
        previous: expect.objectContaining({
          task: "Tarea 3: Describir una fotografía y participar en una conversación",
        }),
        task: expect.objectContaining({ name: "Tarea 4: Diálogo en una situación simulada" }),
      }),
    );
  });

  it("keeps another learner's section from them", async () => {
    const { goal } = await deleLearner();
    const started = await startSpeakingSection({ goalId: goal.id });
    const other = await userFixture();
    mockSession(other.id);

    await expect(
      getSpeakingSection(started.status === "ready" ? started.section.id : ""),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
