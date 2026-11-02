import { generateConversationScenario } from "@zoonk/ai/tasks/language/conversation-scenario";
import { generateExamSpeakingCard } from "@zoonk/ai/tasks/language/exam-speaking-card";
import { mockConditionsSchema } from "@zoonk/core/exams/mocks/contract";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { callContentWorkflow } from "./call-content-workflow";

vi.mock("@zoonk/ai/tasks/language/conversation-scenario", () => ({
  generateConversationScenario: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/language/exam-speaking-card", () => ({
  generateExamSpeakingCard: vi.fn(),
}));

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

const CARD = {
  character: { name: "Lucía", place: "Sala de examen", role: "examinadora" },
  characterBrief: "Give the instruction, listen, then ask a question.",
  hints: ["Desde mi punto de vista…"],
  instructions: ["Hable sobre el tema durante dos minutos."],
  openingLine: "Buenos días.",
  photos: [],
  prompts: ["El transporte en tu ciudad"],
  summary: "Fale sobre o tema.",
  table: null,
  text: null,
};

function modelAnswer<T>(data: T) {
  return {
    data,
    provenance: PROVENANCE,
    systemPrompt: "",
    usage: undefined as never,
    userPrompt: "",
  };
}

async function unwrittenUnitCall() {
  const { renting, user } = await languageGoalFixture();
  await prisma.conversationScenario.deleteMany({ where: { chapterId: renting.id } });

  const unit = {
    description: renting.description,
    id: renting.id,
    language: renting.language,
    objectives: renting.objectives,
    targetLanguage: "en",
    title: renting.title,
  };

  return {
    renting,
    writing: { kind: "unitScenario", level: "A2", unit, userId: user.id } as const,
  };
}

async function deleGoal() {
  const user = await userFixture();

  return goalFixture({
    details: { examName: "DELE", reason: "Preciso do DELE B2 para o mestrado" },
    kind: "exam",
    language: "pt",
    prompt: "Passar no DELE B2",
    targetLanguage: "es",
    title: "DELE B2",
    userId: user.id,
  });
}

describe(callContentWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateConversationScenario).mockReset();
    vi.mocked(generateExamSpeakingCard).mockReset().mockResolvedValue(modelAnswer(CARD));
  });

  it("writes a unit's call once: a second run on the same key joins the first", async () => {
    const { renting, writing } = await unwrittenUnitCall();
    const release = Promise.withResolvers<null>();

    vi.mocked(generateConversationScenario).mockImplementation(async () => {
      await release.promise;
      return modelAnswer(RENTING_SCENARIO);
    });

    const first = await start(callContentWorkflow, [writing]);

    await vi.waitFor(
      () => expect(generateConversationScenario).toHaveBeenCalledWith(expect.anything()),
      { interval: 100, timeout: 30_000 },
    );

    const second = await start(callContentWorkflow, [writing]);

    await expect(second.returnValue).resolves.toStrictEqual({ status: "joined" });
    release.resolve(null);
    await expect(first.returnValue).resolves.toStrictEqual({ status: "written" });

    expect(generateConversationScenario).toHaveBeenCalledOnce();

    await expect(
      prisma.conversationScenario.count({ where: { chapterId: renting.id, level: "A2" } }),
    ).resolves.toBe(1);
  });

  it("retries a failed model call in its own step", async () => {
    const { renting, writing } = await unwrittenUnitCall();

    vi.mocked(generateConversationScenario)
      .mockRejectedValueOnce(new Error("The model is down"))
      .mockResolvedValue(modelAnswer(RENTING_SCENARIO));

    const run = await start(callContentWorkflow, [writing]);

    await expect(run.returnValue).resolves.toStrictEqual({ status: "written" });
    expect(generateConversationScenario).toHaveBeenCalledTimes(2);

    await expect(
      prisma.conversationScenario.count({ where: { chapterId: renting.id, level: "A2" } }),
    ).resolves.toBe(1);
  });

  it("writes a task's card once, and nothing while one is waiting", async () => {
    const goal = await deleGoal();
    const writing = { goalId: goal.id, kind: "examTask", task: "t1", userId: goal.userId } as const;

    for (const attempt of [1, 2]) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- The second run must find the first one's card.
      const run = await start(callContentWorkflow, [writing]);
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each run ends before the next starts.
      await expect(run.returnValue, `run ${attempt}`).resolves.toStrictEqual({ status: "written" });
    }

    expect(generateExamSpeakingCard).toHaveBeenCalledOnce();

    await expect(
      prisma.languageConversation.findMany({
        select: { kind: true, sectionId: true, startedAt: true },
        where: { goalId: goal.id },
      }),
    ).resolves.toStrictEqual([{ kind: "examSpeaking", sectionId: null, startedAt: null }]);
  });

  it("binds a whole speaking paper to its sitting in one save", async () => {
    const goal = await deleGoal();

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
              minutes: 20,
              name: "Expresión e interacción orales",
              questions: 0,
              routing: null,
            },
          ],
          shape: null,
          startTime: null,
          timeZone: null,
          timedOutSections: [],
          wrongPenalty: 0,
        },
        goalId: goal.id,
        sectionStartedAt: new Date(),
        startedAt: new Date(),
        userId: goal.userId,
      },
    });

    const writing = { kind: "speakingPaper", mockId: mock.id, userId: goal.userId } as const;
    const run = await start(callContentWorkflow, [writing]);

    await expect(run.returnValue).resolves.toStrictEqual({ status: "written" });

    const [sitting, calls] = await Promise.all([
      prisma.mockExam.findUniqueOrThrow({ where: { id: mock.id } }),
      prisma.languageConversation.findMany({ where: { goalId: goal.id } }),
    ]);

    const sectionId = mockConditionsSchema.parse(sitting.conditions).sections[0]?.speakingSectionId;

    expect(sectionId).toStrictEqual(expect.any(String));
    expect(calls).toHaveLength(vi.mocked(generateExamSpeakingCard).mock.calls.length);
    expect(calls.length).toBeGreaterThan(1);
    expect(new Set(calls.map((call) => call.sectionId))).toStrictEqual(new Set([sectionId]));
  });
});
