import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getSpeakingSection } from "../../language/exam-speaking/get-speaking-section";
import { type SpeakingSectionView } from "../../language/exam-speaking/speaking-contract";
import { startSpeakingSection } from "../../language/exam-speaking/start-speaking-section";
import { getMock } from "./get-mock";
import { getMockOptions } from "./get-mock-options";
import { startAnytimeMock } from "./start-anytime-mock";
import { startMockSpeaking } from "./start-mock-speaking";
import { submitMockSection } from "./submit-mock-section";

// Writing a paper's cards is a paid model call per task (its storing is tested with
// exam-speaking): here the paper comes back as written.
vi.mock("../../language/exam-speaking/start-speaking-section", () => ({
  startSpeakingSection: vi.fn(),
}));

vi.mock("../../language/exam-speaking/get-speaking-section", () => ({
  getSpeakingSection: vi.fn(),
}));

const SPEAKING = "Expresión e interacción orales";
const READING_QUESTIONS = 6;

/** A task of the paper as `startSpeakingSection` writes it, its call still to do. */
function taskFixture(key: string, name: string) {
  return {
    conversationId: randomUUID(),
    key,
    minutes: { max: 6, min: 4 },
    mode: "monologue" as const,
    name,
    options: 2,
    prepMinutes: 10,
    prepShared: null,
    role: "examiner" as const,
    status: "ready" as const,
    stimulus: "topic" as const,
  };
}

/** A DELE B2 paper of two tasks as `startSpeakingSection` writes it, every call still to do. */
function paperFixture(): SpeakingSectionView {
  return {
    estimate: { complete: false, high: null, low: null, total: 25, typed: false },
    exam: "dele",
    id: randomUUID(),
    language: "es",
    level: "B2",
    paper: SPEAKING,
    pass: { kind: "group", min: 30, of: 50 },
    prepMinutes: 20,
    prepTasks: ["t1", "t2"],
    source: "https://examenes.cervantes.es",
    tasks: [taskFixture("t1", "Tarea 1"), taskFixture("t2", "Tarea 2")],
    title: "DELE B2",
  };
}

/** A DELE B2 learner on Plus: a reading section the bank holds, then the speaking paper. */
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

describe(startMockSpeaking, () => {
  it("preserves a paused paper refusal on the active speaking section without attaching a paper", async () => {
    const { goal } = await speakingSetup();
    vi.mocked(startSpeakingSection).mockResolvedValue({ status: "callsPaused" });

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { shape: { area: null, day: null, kind: "full" }, timeZone: "UTC" },
    });

    if (started.status !== "started") {
      throw new Error(`Expected a started mock, got ${started.status}`);
    }

    await submitMockSection({ blockId: started.id, input: { timeZone: "UTC" }, section: 0 });
    const reached = await getMock(started.id);
    expect(reached.status === "ready" && reached.mock.current).toMatchObject({ kind: "speaking" });
    const before = await prisma.mockExam.findUniqueOrThrow({ where: { id: started.id } });

    await expect(startMockSpeaking({ blockId: started.id })).resolves.toStrictEqual({
      status: "callsPaused",
    });

    const after = await prisma.mockExam.findUniqueOrThrow({ where: { id: started.id } });
    expect(after.conditions).toStrictEqual(before.conditions);
    expect(after.conditions).not.toHaveProperty("sections.1.speakingSectionId");
    expect(startSpeakingSection).toHaveBeenCalledExactlyOnceWith({ goalId: goal.id });
    expect(getSpeakingSection).not.toHaveBeenCalled();
  });

  it("sits the speaking paper in a full mock only: written once the learner reaches it, the same one after", async () => {
    const { goal } = await speakingSetup();
    const paper = paperFixture();

    vi.mocked(startSpeakingSection).mockResolvedValue({ section: paper, status: "ready" });
    vi.mocked(getSpeakingSection).mockResolvedValue({ section: paper, status: "ready" });

    const options = await getMockOptions({ goalId: goal.id });
    const listed = options.status === "ready" ? options.view.options : [];
    const full = listed.find((option) => option.kind === "full");
    const half = listed.find((option) => option.kind === "half");

    expect(full?.leftOut.map((part) => part.part)).not.toContain("speaking");

    // Half of the exam leaves the paper to full mocks, and says so.
    expect(half?.leftOut).toContainEqual({ name: SPEAKING, part: "speaking" });

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { shape: { area: null, day: null, kind: "full" }, timeZone: "UTC" },
    });

    if (started.status !== "started") {
      throw new Error(`Expected a started mock, got ${started.status}`);
    }

    // The paper isn't written before the learner gets to it.
    await expect(startMockSpeaking({ blockId: started.id })).resolves.toStrictEqual({
      status: "notSpeaking",
    });

    await submitMockSection({ blockId: started.id, input: { timeZone: "UTC" }, section: 0 });

    const reached = await getMock(started.id);

    expect(reached.status === "ready" && reached.mock.current).toMatchObject({
      kind: "speaking",
      questions: [],
    });

    await expect(startMockSpeaking({ blockId: started.id })).resolves.toStrictEqual({
      section: paper,
      status: "ready",
    });

    await expect(startMockSpeaking({ blockId: started.id })).resolves.toMatchObject({
      section: { id: paper.id },
    });

    expect(startSpeakingSection).toHaveBeenCalledOnce();

    const sat = await getMock(started.id);

    expect(sat.status === "ready" && sat.mock.speaking).toStrictEqual(paper);

    expect(sat.status === "ready" && sat.mock.leftOut.map((part) => part.part)).not.toContain(
      "speaking",
    );
  });
});
