import { gradeWritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { writeWritingPrompt } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { recordLearnerAnswer } from "../../learner/record-learner-answer";
import { getWritingPromptId, writeWritingItem } from "../../library/items/write-writing-item";
import { getTodayStudySession } from "../../sessions/_test-utils/open-today";
import { finishStudyBlock } from "../../sessions/finish-study-block";
import { CGU } from "../mocks/_test-utils/cgu-written";
import { pickWrittenTestDays } from "../mocks/written-test-schedule";
import { getEssay } from "./get-essay";
import { saveWritingDraft } from "./save-writing-draft";
import { startWriting } from "./start-writing";
import { submitEssay } from "./submit-essay";

// Stub the two model boundaries and run the planner, prompt bank, admissions and recorder on PostgreSQL.
vi.mock("@zoonk/ai/tasks/grading/grade-essay", () => ({ gradeWritingEvidence: vi.fn() }));
vi.mock("@zoonk/ai/tasks/items/write-writing-prompt", () => ({ writeWritingPrompt: vi.fn() }));

const NOW = new Date("2026-09-30T12:00:00Z");
const TARGET = new Date("2026-10-28");
const DAY_MS = 86_400_000;

const TEXT =
  "An audit recommendation should address the cause of the finding. The report should explain which control failed, how the failure affected the result, and what evidence supports the proposed correction.";

async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);

  const [user, blueprint, writing] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure: CGU }),
    skillFixture(),
  ]);

  const goal = await goalFixture({
    createdAt: NOW,
    dailyMinutes: 240,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: TARGET,
    timezone: "UTC",
    userId: user.id,
  });

  const graph = {
    phases: [{ milestone: null, name: "Basics" }],
    skills: [
      {
        area: "Writing",
        lessons: 1,
        name: writing.name,
        phase: 0,
        skillId: writing.id,
        weight: null,
      },
    ],
  };

  const plan = await planFixture({ goalId: goal.id, graph, settings: { startDate: "2026-09-30" } });
  await planItemFixture({ kind: "lesson", planId: plan.id, skillId: writing.id, status: "done" });

  mockSession(user.id);
  return { blueprint, goal, user, writing };
}

async function openWritingDay(goalId: string) {
  const today = await getTodayStudySession({ goalId, timeZone: "UTC" });

  if (today.status !== "ready") {
    throw new Error("Expected the exam study day to open");
  }

  const block = today.session.blocks.find(({ kind }) => kind === "produce");

  if (!block) {
    throw new Error("Expected a whole-answer block");
  }

  return { block, sessionId: today.session.id };
}

function useModelFixtures(skillId: string) {
  vi.mocked(writeWritingPrompt, { partial: true }).mockResolvedValue({
    data: {
      aspects: [{ criterionId: "case", description: "Supports the recommendation", points: 1 }],
      assessedSkillIds: [skillId],
      context: null,
      criteria: [{ id: "case", name: "Application", points: 1 }],
      keyPoints: ["Identify the failed control"],
      question: "Explain how an audit report supports a recommendation.",
      sampleOutline: "State the recommendation, the finding and the evidence.",
      title: "Audit recommendations",
    },
    provenance: {
      generatedAt: NOW.toISOString(),
      latencyMs: 1,
      model: "fixture",
      promptVersion: "fixture",
      provider: "fixture",
      requestedModel: "fixture",
      runId: "fixture",
      usage: {},
    },
  });

  vi.mocked(gradeWritingEvidence, { partial: true }).mockResolvedValue({
    data: {
      aspects: [
        { aspectIndex: 0, criterionId: "case", earned: true, quote: "which control failed" },
      ],
      criteria: [
        {
          comment: "The recommendation addresses the cause.",
          example: null,
          id: "case",
          level: "strong",
          quote: null,
        },
      ],
      errors: [],
      nextStep: null,
      zeroRuleIndex: null,
    },
  });
}

describe("CGU written exam preparation", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps the issued CGU basis, credits only written evidence, and grades a completed block's rewrite once", async () => {
    const { blueprint, goal, user, writing } = await setup();
    useModelFixtures(writing.id);

    const { block, sessionId } = await openWritingDay(goal.id);
    const request = await startWriting({ blockId: block.id });

    expect(request).toMatchObject({
      input: { taskKey: "short", unit: "answer" },
      status: "needsPrompt",
    });

    if (request.status !== "needsPrompt") {
      throw new Error("Expected the empty bank to need a prompt");
    }

    const itemId = getWritingPromptId(crypto.randomUUID(), 0);
    await writeWritingItem(request.input, itemId);

    const started = await startWriting({ blockId: block.id });

    if (started.status !== "ready") {
      throw new Error(started.status);
    }

    await expect(startWriting({ blockId: block.id })).resolves.toStrictEqual(started);
    await expect(prisma.writingAdmission.count({ where: { userId: user.id } })).resolves.toBe(1);

    await expect(
      saveWritingDraft({
        blockId: block.id,
        input: { admissionId: started.admissionId, revision: 0, text: TEXT },
      }),
    ).resolves.toMatchObject({ draft: { revision: 1, text: TEXT }, status: "ready" });

    await expect(getEssay({ blockId: block.id })).resolves.toMatchObject({
      essay: { draft: { revision: 1, text: TEXT }, writing: { lines: 30, points: 30 } },
      status: "ready",
    });

    const objective = await itemFixture({ content: choiceItemContent(), skillId: writing.id });

    await recordLearnerAnswer({
      answer: { selectedIndex: 0 },
      graded: { durationMs: 1000, isCorrect: true, score: 1 },
      itemId: objective.id,
      language: goal.language,
      purpose: "learning",
      skillId: writing.id,
      timeZone: "UTC",
      userId: user.id,
    });

    const skillRow = { userSkill: { skillId: writing.id, userId: user.id } };
    await expect(prisma.learnerSkill.findUnique({ where: skillRow })).resolves.toBeNull();

    const structure = structuredClone(CGU);
    const task = structure.mock?.sections.find(({ kind }) => kind === "written")?.tasks?.[0];

    if (!task) {
      throw new Error("Expected the CGU short task");
    }

    task.lines = 1;
    task.points = 12;
    await prisma.examBlueprint.update({ data: { structure }, where: { id: blueprint.id } });

    const input = {
      admissionId: started.admissionId,
      durationMs: 1000,
      text: TEXT,
      timeZone: "UTC",
    };

    await expect(submitEssay({ blockId: block.id, input })).resolves.toMatchObject({
      grade: { criteria: [{ id: "case", level: "strong" }], ignoredFrom: null, kind: "levels" },
      status: "writingGraded",
    });

    const first = await prisma.attempt.findFirstOrThrow({ where: { itemId, userId: user.id } });
    expect(first.score).toBeNull();

    await expect(prisma.learnerSkill.findUnique({ where: skillRow })).resolves.toMatchObject({
      state: "solid",
    });

    await expect(
      finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId }),
    ).resolves.toMatchObject({ status: "ready" });

    const originalSession = await prisma.studySession.findUniqueOrThrow({
      where: { id: sessionId },
    });

    const rewrite = await startWriting({ blockId: block.id, previousAttemptId: first.id });

    if (rewrite.status !== "ready") {
      throw new Error(rewrite.status);
    }

    const rewritten = {
      ...input,
      admissionId: rewrite.admissionId,
      text: `${TEXT} The recommendation assigns ownership.`,
    };

    const result = await submitEssay({ blockId: block.id, input: rewritten });
    expect(result).toMatchObject({ grade: { kind: "levels" }, status: "writingGraded" });

    await expect(
      submitEssay({ blockId: block.id, input: { ...rewritten, text: "A stale duplicate." } }),
    ).resolves.toStrictEqual(result);

    expect(gradeWritingEvidence).toHaveBeenCalledTimes(2);
    await expect(prisma.attempt.count({ where: { itemId, userId: user.id } })).resolves.toBe(2);

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } }),
    ).resolves.toStrictEqual(originalSession);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "completed" });

    await expect(prisma.learnerSkill.findUnique({ where: skillRow })).resolves.toMatchObject({
      state: "solid",
    });
  });

  it("gives a free learner a whole-answer block on a date chosen for a written test", async () => {
    const { goal } = await setup();

    const studyDays = Array.from({ length: 28 }, (_, offset) => ({
      date: new Date(NOW.getTime() + offset * DAY_MS).toISOString().slice(0, 10),
      minutes: 240,
    }));

    const [middle] = pickWrittenTestDays({ sectionMinutes: 210, studyDays, targetDate: TARGET });
    expect(middle).toBe("2026-10-14");
    vi.setSystemTime(new Date(`${middle}T12:00:00Z`));
    const { block, sessionId } = await openWritingDay(goal.id);
    const blocks = await prisma.studySessionBlock.findMany({ where: { sessionId } });

    expect(blocks.find(({ id }) => id === block.id)).toMatchObject({
      kind: "produce",
      payload: { writing: { taskKey: "short", unit: "answer" } },
    });

    expect(blocks.some(({ kind }) => kind === "checkpoint")).toBe(false);
  });
});
