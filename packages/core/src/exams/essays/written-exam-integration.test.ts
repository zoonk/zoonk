import { gradeWritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { writeWritingPrompt } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { recordLearnerAnswer } from "../../learner/record-learner-answer";
import { buildExamIdentityKey } from "../../library/exams/exam-identity";
import { readBlueprintContent, saveExamBlueprint } from "../../library/exams/save-exam-blueprint";
import { getWritingPromptId, writeWritingItem } from "../../library/items/write-writing-item";
import { getTodayStudySession } from "../../sessions/_test-utils/open-today";
import { finishStudyBlock } from "../../sessions/finish-study-block";
import { getStudyBlock } from "../../sessions/get-study-block";
import { getStudySession } from "../../sessions/get-study-session";
import { openStudyBlock } from "../../sessions/open-block";
import { getSyllabusView } from "../../view-models/syllabus/get-syllabus-view";
import { getTodayView } from "../../view-models/today/get-today-view";
import { CGU } from "../mocks/_test-utils/cgu-written";
import { pickWrittenTestDays } from "../mocks/written-test-schedule";
import { loadSessionProduce } from "./_utils/load-produce";
import { createWritingBlock } from "./create-writing-block";
import { getEssay } from "./get-essay";
import { getWritingAttempt } from "./get-writing-attempt";
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

async function setup(structure = CGU) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);

  const [user, blueprint, writing] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      board: "Cebraspe",
      name: "CGU",
      structure: {
        ...structure,
        subjects: structure.subjects.map((subject) =>
          subject.name === "Writing" ? { ...subject, topics: ["Government auditing"] } : subject,
        ),
      },
    }),
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
      onTopicQuote: null,
      zeroKind: null,
      zeroQuote: null,
      zeroRuleIndex: null,
    },
  });
}

describe("CGU written exam preparation", () => {
  afterEach(() => vi.useRealTimers());

  it("names a refused extra task before issuing its prompt and marks it unavailable on read", async () => {
    const { goal, user } = await setup();
    const short = { distinctLines: true, lines: 30, number: 1, points: 30, total: 2 };
    const long = { distinctLines: true, lines: 60, number: 2, points: 70, total: 2 };

    await expect(getTodayView({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      status: "ready",
      today: {
        session: {
          blocks: expect.arrayContaining([
            expect.objectContaining({ title: "Short question", writingTask: short }),
          ]),
          status: "unstarted",
        },
      },
    });

    const scheduled = await openWritingDay(goal.id);
    const created = await createWritingBlock({ goalId: goal.id, taskKey: "long" });

    if (created.status !== "ready") {
      throw new Error(created.status);
    }

    const { blockId } = created;
    const readSyllabus = () => getSyllabusView({ goalId: goal.id });
    expect(scheduled.block).toMatchObject({ title: "Short question", writingTask: short });

    await expect(readSyllabus()).resolves.toMatchObject({
      syllabus: {
        writtenPractice: {
          subjects: [
            {
              points: {
                tasks: [
                  { key: "short", writingTask: short },
                  { key: "long", writingTask: long },
                ],
              },
              writeActions: expect.arrayContaining([
                {
                  availability: { status: "available" },
                  blockId,
                  taskKey: "long",
                  writingTask: long,
                },
              ]),
            },
          ],
        },
      },
    });

    await prisma.writingAdmission.createMany({
      data: Array.from({ length: 6 }, () => ({
        extra: true,
        id: crypto.randomUUID(),
        itemIds: [],
        localDate: new Date("2026-09-30"),
        userId: user.id,
      })),
    });

    await expect(startWriting({ blockId })).resolves.toStrictEqual({
      returnsOn: "2026-10-01",
      status: "limitReached",
      task: {
        description: "Long question",
        distinctLines: true,
        lines: 60,
        minutes: 140,
        number: 2,
        points: 70,
        taskKey: "long",
        total: 2,
        unit: "answer",
        writingTask: long,
      },
      unit: "answer",
    });

    await expect(getEssay({ blockId })).resolves.toStrictEqual({ status: "notFound" });

    const tomorrow = { returnsOn: "2026-10-01", status: "tomorrow" };

    await expect(
      getStudySession({ input: {}, sessionId: scheduled.sessionId }),
    ).resolves.toMatchObject({
      session: {
        blocks: expect.arrayContaining([
          expect.objectContaining({
            id: blockId,
            writingAvailability: tomorrow,
            writingTask: long,
          }),
          expect.objectContaining({
            id: scheduled.block.id,
            writingAvailability: { status: "available" },
            writingTask: short,
          }),
        ]),
      },
    });

    await expect(readSyllabus()).resolves.toMatchObject({
      syllabus: {
        writtenPractice: {
          subjects: [
            {
              writeActions: expect.arrayContaining([
                { availability: tomorrow, blockId, taskKey: "long", writingTask: long },
              ]),
            },
          ],
        },
      },
    });

    const stranger = await userFixture();
    mockSession(stranger.id);
    await expect(startWriting({ blockId })).resolves.toStrictEqual({ status: "notFound" });
  });

  it("numbers repeated questions in notice order, including questions with equal or unstated limits", async () => {
    const structure = structuredClone(CGU);
    const written = structure.mock?.sections.find(({ kind }) => kind === "written");

    if (!written) {
      throw new Error("Expected a written section");
    }

    written.tasks = [
      { count: 2, description: "Two audit questions", key: "audit", lines: 30, points: 15 },
      { count: 1, description: "A policy question", key: "policy", lines: 40, points: 30 },
      { count: 1, description: "A budget question", key: "budget", lines: 40, points: 40 },
      { count: 1, description: "An open response", key: "open" },
    ];

    const { goal } = await setup(structure);

    await expect(getSyllabusView({ goalId: goal.id })).resolves.toMatchObject({
      syllabus: {
        writtenPractice: {
          subjects: [
            {
              questions: 5,
              writeActions: [
                {
                  taskKey: "audit",
                  writingTask: { distinctLines: false, lines: 30, number: 1, points: 15, total: 5 },
                },
                {
                  taskKey: "policy",
                  writingTask: { distinctLines: false, lines: 40, number: 3, points: 30, total: 5 },
                },
                {
                  taskKey: "budget",
                  writingTask: { distinctLines: false, lines: 40, number: 4, points: 40, total: 5 },
                },
                {
                  taskKey: "open",
                  writingTask: {
                    distinctLines: false,
                    lines: null,
                    number: 5,
                    points: null,
                    total: 5,
                  },
                },
              ],
            },
          ],
        },
      },
    });
  });

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

    expect(writeWritingPrompt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          board: "Cebraspe",
          choices: [],
          exam: "CGU",
          subject: { name: "Writing", topics: ["Government auditing"] },
        }),
      }),
    );

    const started = await startWriting({ blockId: block.id });

    if (started.status !== "ready") {
      throw new Error(started.status);
    }

    await expect(startWriting({ blockId: block.id })).resolves.toStrictEqual(started);
    await expect(prisma.writingAdmission.count({ where: { userId: user.id } })).resolves.toBe(1);

    const shortTask = { distinctLines: true, lines: 30, number: 1, points: 30, total: 2 };

    await expect(getEssay({ blockId: block.id })).resolves.toMatchObject({
      essay: { admissionId: started.admissionId, draft: null, writingTask: shortTask },
      status: "ready",
    });

    await expect(
      saveWritingDraft({
        blockId: block.id,
        input: { admissionId: started.admissionId, revision: 0, text: TEXT },
      }),
    ).resolves.toMatchObject({ draft: { revision: 1, text: TEXT }, status: "ready" });

    await expect(getEssay({ blockId: block.id })).resolves.toMatchObject({
      essay: {
        admissionId: started.admissionId,
        draft: { admissionId: started.admissionId, revision: 1, text: TEXT },
        writing: {
          lines: 30,
          partMinimum: { max: 100, minimum: { unit: "points", value: 50 } },
          points: 30,
        },
      },
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

    const withoutShort = readBlueprintContent(blueprint).structure;
    const written = withoutShort.mock?.sections.find(({ kind }) => kind === "written");

    if (!written?.tasks) {
      throw new Error("Expected written tasks");
    }

    written.tasks = written.tasks.filter(({ key }) => key !== "short");

    await prisma.examBlueprint.update({
      data: { structure: withoutShort },
      where: { id: blueprint.id },
    });

    vi.setSystemTime(new Date(NOW.getTime() + 2 * DAY_MS));

    const continued = await openWritingDay(goal.id);
    expect(continued.block.id).toBe(block.id);
    expect(continued.sessionId).toBe(sessionId);

    const continuedEssay = await getEssay({ blockId: block.id });

    expect(continuedEssay).toMatchObject({
      essay: { draft: { revision: 1, text: TEXT }, writing: { lines: 30, points: 30 } },
      status: "ready",
    });

    expect(continuedEssay).not.toHaveProperty("essay.writingTask");

    const structure = structuredClone(CGU);
    const task = structure.mock?.sections.find(({ kind }) => kind === "written")?.tasks?.[0];

    if (!task) {
      throw new Error("Expected the CGU short task");
    }

    const part = structure.mock?.scoring.parts?.find(({ name }) => name === "Written test");

    if (part) {
      part.minimum = { unit: "points", value: 60 };
    }

    task.lines = 1;
    task.points = 12;
    await prisma.examBlueprint.update({ data: { structure }, where: { id: blueprint.id } });

    const text = [
      TEXT,
      ...Array.from({ length: 19 }, () => "The finding supports this recommendation."),
    ].join("\n");

    const input = { admissionId: started.admissionId, durationMs: 1000, text, timeZone: "UTC" };

    await expect(submitEssay({ blockId: block.id, input })).resolves.toMatchObject({
      grade: {
        criteria: [{ id: "case", level: "strong" }],
        estimatedLines: 23,
        ignoredFrom: null,
        kind: "levels",
      },
      status: "writingGraded",
    });

    const first = await prisma.attempt.findFirstOrThrow({ where: { itemId, userId: user.id } });
    expect(first.score).toBeNull();
    expect(first.answer).toMatchObject({ conditions: { estimatedLines: 23 } });

    const currentTask = { ...shortTask, lines: 1, points: 12 };

    await expect(getEssay({ blockId: block.id })).resolves.toMatchObject({
      essay: {
        admissionId: started.admissionId,
        draft: null,
        drafts: [{ attemptId: first.id, writingTask: currentTask }],
        writingTask: currentTask,
      },
      status: "ready",
    });

    await expect(getSyllabusView({ goalId: goal.id })).resolves.toMatchObject({
      syllabus: {
        writtenPractice: {
          subjects: [
            {
              answers: [{ attemptId: first.id, criteria: { complete: 0, total: 1 }, range: null }],
              decimals: 0,
              scale: "levels",
            },
          ],
        },
      },
    });

    await expect(getWritingAttempt(first.id)).resolves.toMatchObject({
      attempt: {
        grade: { estimatedLines: 23 },
        writing: { partMinimum: { max: 100, minimum: { unit: "points", value: 50 } } },
        writingTask: currentTask,
      },
      status: "ready",
    });

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

    expect(rewrite.admissionId).not.toBe(started.admissionId);

    await expect(getEssay({ blockId: block.id })).resolves.toMatchObject({
      essay: { admissionId: rewrite.admissionId, draft: null, drafts: [{ attemptId: first.id }] },
      status: "ready",
    });

    const rewritten = {
      ...input,
      admissionId: rewrite.admissionId,
      text: `${TEXT} The recommendation assigns ownership.`,
    };

    vi.mocked(gradeWritingEvidence).mockRejectedValueOnce(
      new Error("Grading is temporarily unavailable"),
    );

    await expect(submitEssay({ blockId: block.id, input: rewritten })).rejects.toThrow(
      "Grading is temporarily unavailable",
    );

    const [result, concurrent] = await Promise.all([
      submitEssay({ blockId: block.id, input: rewritten }),
      submitEssay({ blockId: block.id, input: rewritten }),
    ]);

    expect(result).toMatchObject({ grade: { kind: "levels" }, status: "writingGraded" });
    expect(concurrent).toStrictEqual(result);

    await expect(
      submitEssay({ blockId: block.id, input: { ...rewritten, text: "A stale duplicate." } }),
    ).resolves.toStrictEqual(result);

    expect(gradeWritingEvidence).toHaveBeenCalledTimes(3);
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

    const other = await userFixture();
    mockSession(other.id);
    await expect(getEssay({ blockId: block.id })).resolves.toStrictEqual({ status: "notFound" });
  });

  it("drops an unissued task from the day and Continue after the notice is read again", async () => {
    const { blueprint, goal } = await setup();
    const { block, sessionId } = await openWritingDay(goal.id);
    const content = readBlueprintContent(blueprint);
    const written = content.structure.mock?.sections.find(({ kind }) => kind === "written");

    if (!written?.tasks) {
      throw new Error("Expected written tasks");
    }

    const identity = { ...blueprint, country: "BR", role: blueprint.id };

    const [source] = await Promise.all([
      sourceFixture(),
      prisma.examBlueprint.update({
        data: { identityKey: buildExamIdentityKey(identity), role: identity.role },
        where: { id: blueprint.id },
      }),
    ]);

    written.tasks = written.tasks.filter(({ key }) => key !== "short");

    const reread = await saveExamBlueprint({
      content: { ...content, edition: { ...content.edition, sourceHash: source.contentHash } },
      identity,
      provenance: {
        generatedAt: NOW.toISOString(),
        model: "fixture",
        promptVersion: "fixture",
        runId: "fixture",
      },
      reread: true,
      sourceId: source.id,
    });

    expect(reread.blueprint.id).toBe(blueprint.id);

    const day = await getStudySession({ input: {}, sessionId });

    if (day.status !== "ready") {
      throw new Error(day.status);
    }

    const [next] = day.session.blocks;
    expect(day.session.blocks).toMatchObject([{ title: "Long question" }]);
    expect(day.session.nextBlockId).toBe(next?.id);
    expect(next?.id).not.toBe(block.id);

    await expect(
      openStudyBlock({ target: { expectedBlockId: block.id, kind: "next", sessionId } }),
    ).resolves.toMatchObject({ opening: { blockId: next?.id, kind: "essay" } });

    const detail = await getStudyBlock({ blockId: block.id, sessionId });

    expect(detail).toMatchObject({
      detail: { block: { title: "Short question", writingUnit: "answer" } },
      status: "ready",
    });

    expect(detail.status === "ready" && detail.detail.block).not.toHaveProperty("writingTask");

    await expect(startWriting({ blockId: block.id })).resolves.toMatchObject({
      status: "taskRemoved",
      unit: "answer",
    });

    await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

    await expect(
      prisma.studySessionBlock.findUnique({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "skipped" });
  });

  it("writes a new prompt when the only unseen prompt uses superseded points", async () => {
    const { blueprint, goal, user, writing } = await setup();
    useModelFixtures(writing.id);

    const request = {
      count: 1,
      goalId: goal.id,
      taskKey: "short",
      unit: "answer" as const,
      userId: user.id,
    };

    const staleId = getWritingPromptId(crypto.randomUUID(), 0);
    await writeWritingItem(request, staleId);

    const structure = structuredClone(CGU);
    const task = structure.mock?.sections.find(({ kind }) => kind === "written")?.tasks?.[0];

    if (!task) {
      throw new Error("Expected the CGU short task");
    }

    task.points = 40;
    await prisma.examBlueprint.update({ data: { structure }, where: { id: blueprint.id } });

    const { block } = await openWritingDay(goal.id);

    await expect(startWriting({ blockId: block.id })).resolves.toMatchObject({
      status: "needsPrompt",
    });

    const currentId = getWritingPromptId(crypto.randomUUID(), 0);
    await writeWritingItem(request, currentId);

    await expect(startWriting({ blockId: block.id })).resolves.toMatchObject({ status: "ready" });

    await expect(getEssay({ blockId: block.id })).resolves.toMatchObject({
      essay: { writing: { points: 40, taskKey: "short" } },
      status: "ready",
    });

    await expect(prisma.item.findUnique({ where: { id: staleId } })).resolves.toMatchObject({
      content: { writing: { points: 30 } },
      retiredAt: null,
    });
  });

  it("gives a free learner a whole-answer block on a date chosen for a written test", async () => {
    const { goal, user, writing } = await setup();
    useModelFixtures(writing.id);

    const studyDays = Array.from({ length: 28 }, (_, offset) => ({
      date: new Date(NOW.getTime() + offset * DAY_MS).toISOString().slice(0, 10),
      minutes: 240,
    }));

    const [middle] = pickWrittenTestDays({ sectionMinutes: 210, studyDays, targetDate: TARGET });
    expect(middle).toBe("2026-10-14");
    const today = new Date(`${middle}T00:00:00Z`);
    const itemId = getWritingPromptId(crypto.randomUUID(), 0);

    await writeWritingItem(
      { count: 1, goalId: goal.id, taskKey: "long", unit: "answer", userId: user.id },
      itemId,
    );

    await attemptFixture({
      answer: {
        conditions: {
          admissionId: crypto.randomUUID(),
          estimatedLines: 8,
          origin: "block",
          timed: false,
          version: "firstDraft",
        },
        grade: {
          criteria: [],
          errors: [],
          ignoredFrom: null,
          kind: "levels",
          nextStep: null,
          progress: null,
        },
        text: TEXT,
      },
      answeredAt: new Date(today.getTime() - DAY_MS),
      itemId,
      userId: user.id,
    });

    vi.setSystemTime(new Date(`${middle}T12:00:00Z`));

    await expect(
      loadSessionProduce({
        goal,
        planSettings: { startDate: "2026-09-30" },
        today,
        userId: user.id,
      }),
    ).resolves.toBeNull();

    const { block, sessionId } = await openWritingDay(goal.id);
    const blocks = await prisma.studySessionBlock.findMany({ where: { sessionId } });

    expect(blocks.find(({ id }) => id === block.id)).toMatchObject({
      kind: "produce",
      payload: { writing: { taskKey: "short", unit: "answer" } },
    });

    expect(blocks.some(({ kind }) => kind === "checkpoint")).toBe(false);
  });
});
