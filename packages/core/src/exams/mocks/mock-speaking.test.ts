import { randomUUID } from "node:crypto";
import { generateExamSpeakingCard } from "@zoonk/ai/tasks/language/exam-speaking-card";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listOwed } from "../../_test-utils/follow-ups";
import { mockSession } from "../../_test-utils/mock-session";
import { writeTestCall } from "../../language/conversations/_test-utils/write-test-call";
import { getMock } from "./get-mock";
import { getMockOptions } from "./get-mock-options";
import { mockConditionsSchema } from "./mock-contract";
import { startAnytimeMock } from "./start-anytime-mock";
import { startMockSpeaking } from "./start-mock-speaking";
import { submitMockSection } from "./submit-mock-section";

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

const SPEAKING = "Expresión e interacción orales";
const READING_QUESTIONS = 6;

async function speakingSetup() {
  const [user, blueprint, reading] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      language: "pt",
      name: "DELE B2",
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "", method: "raw" },
          sections: [
            {
              day: null,
              kind: "objective",
              minutes: 12,
              name: "Comprensión de lectura",
              questions: READING_QUESTIONS,
            },
            { day: null, kind: "speaking", minutes: 20, name: SPEAKING, questions: null },
          ],
          timeLimitMinutes: 32,
          totalQuestions: READING_QUESTIONS,
        },
        rules: [],
        subjects: [],
      },
    }),
    skillFixture({ name: `Lectura ${randomUUID()}` }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetLanguage: "es",
    timezone: "UTC",
    title: "DELE B2",
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Base" }],
      skills: [
        {
          area: "Lectura",
          lessons: 1,
          name: reading.name,
          phase: 0,
          skillId: reading.id,
          weight: null,
        },
      ],
    },
  });

  await Promise.all([
    planItemFixture({ kind: "lesson", planId: plan.id, position: 0, skillId: reading.id }),
    ...Array.from({ length: READING_QUESTIONS }, () =>
      itemFixture({
        content: choiceItemContent(),
        examBlueprintId: blueprint.id,
        skillId: reading.id,
      }),
    ),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);

  return { goal };
}

async function startFullMock(goalId: string) {
  const started = await startAnytimeMock({
    goalId,
    input: { shape: { area: null, day: null, kind: "full" } },
  });

  if (started.status !== "started") {
    throw new Error(`Expected a started mock, got ${started.status}`);
  }

  return started.id;
}

async function readSpeakingSectionId(mockId: string) {
  const mock = await prisma.mockExam.findUniqueOrThrow({ where: { id: mockId } });
  return mockConditionsSchema.parse(mock.conditions).sections[1]?.speakingSectionId ?? null;
}

describe(startMockSpeaking, () => {
  beforeEach(() => {
    vi.mocked(generateExamSpeakingCard).mockResolvedValue({
      data: {
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
      },
      provenance: PROVENANCE,
      systemPrompt: "",
      usage: undefined as never,
      userPrompt: "",
    });
  });

  it("owes the speaking paper in the transaction that starts a sitting with a speaking part", async () => {
    const { goal } = await speakingSetup();
    const mockId = await startFullMock(goal.id);

    await expect(listOwed(goal.userId)).resolves.toContainEqual({
      input: { mockId },
      key: mockId,
      kind: "writeSpeakingPaper",
    });
  });

  it("asks for a paper that isn't written yet, attaching nothing", async () => {
    const { goal } = await speakingSetup();
    const mockId = await startFullMock(goal.id);

    await submitMockSection({ blockId: mockId, input: { timeZone: "UTC" }, section: 0 });
    const before = await prisma.mockExam.findUniqueOrThrow({ where: { id: mockId } });

    await expect(startMockSpeaking({ blockId: mockId })).resolves.toStrictEqual({
      status: "preparing",
      writing: { kind: "speakingPaper", mockId, userId: goal.userId },
    });

    const after = await prisma.mockExam.findUniqueOrThrow({ where: { id: mockId } });
    expect(after.conditions).toStrictEqual(before.conditions);
    expect(generateExamSpeakingCard).not.toHaveBeenCalled();
  });

  it("binds the paper once when two runs write it at the same time", async () => {
    const { goal } = await speakingSetup();
    const mockId = await startFullMock(goal.id);
    const writing = { kind: "speakingPaper", mockId, userId: goal.userId } as const;

    await Promise.all([writeTestCall(writing), writeTestCall(writing)]);

    const sectionId = await readSpeakingSectionId(mockId);

    expect(sectionId).toStrictEqual(expect.any(String));

    const calls = await prisma.languageConversation.findMany({
      select: { sectionId: true },
      where: { kind: "examSpeaking", userId: goal.userId },
    });

    expect(new Set(calls.map((call) => call.sectionId))).toStrictEqual(new Set([sectionId]));
  });

  it("sits the paper written ahead in a full mock only, shown once the learner reaches it", async () => {
    const { goal } = await speakingSetup();
    const options = await getMockOptions({ goalId: goal.id });
    const listed = options.status === "ready" ? options.view.options : [];
    const full = listed.find((option) => option.kind === "full");
    const half = listed.find((option) => option.kind === "half");

    expect(full?.leftOut.map((part) => part.part)).not.toContain("speaking");
    expect(half?.leftOut).toContainEqual({ name: SPEAKING, part: "speaking" });

    const mockId = await startFullMock(goal.id);
    await writeTestCall({ kind: "speakingPaper", mockId, userId: goal.userId });

    const early = await getMock(mockId);
    expect(early.status === "ready" && early.mock.speaking).toBeNull();

    await expect(startMockSpeaking({ blockId: mockId })).resolves.toStrictEqual({
      status: "notSpeaking",
    });

    await submitMockSection({ blockId: mockId, input: { timeZone: "UTC" }, section: 0 });

    const reached = await getMock(mockId);

    expect(reached.status === "ready" && reached.mock.current).toMatchObject({
      kind: "speaking",
      questions: [],
    });

    const sectionId = await readSpeakingSectionId(mockId);
    const started = await startMockSpeaking({ blockId: mockId });

    expect(started).toMatchObject({ section: { id: sectionId }, status: "ready" });
    await expect(startMockSpeaking({ blockId: mockId })).resolves.toStrictEqual(started);

    const sat = await getMock(mockId);

    expect(sat.status === "ready" && sat.mock.speaking).toMatchObject({ id: sectionId });

    expect(sat.status === "ready" && sat.mock.leftOut.map((part) => part.part)).not.toContain(
      "speaking",
    );
  });
});
