import { randomUUID } from "node:crypto";
import { gradeWritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { observeDatabaseQueries } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { loadWrittenSamples } from "../../learner/facts/written-samples";
import { loadWritingEvidence } from "../../learner/written-evidence";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listWrittenTasks } from "../../library/exams/written-tasks";
import { SESSION_NOW, SESSION_TODAY } from "../../sessions/_test-utils/session-goal";
import { getSyllabusView } from "../../view-models/syllabus/get-syllabus-view";
import {
  calibrationFixture,
  rowCalibrationFixture,
  weightedResiduals,
} from "../essays/_test-utils/writing-calibration";
import { readEssayContent } from "../essays/_utils/essay-content";
import { type WritingCalibration } from "../essays/_utils/writing-calibration";
import { getWritingAttempt } from "../essays/get-writing-attempt";
import { WRITING_MAX_CHARACTERS_PER_LINE } from "../essays/writing-lines";
import { loadGoalWrittenProjection } from "../estimates/load-goal-written-projection";
import { loadWrittenProjection } from "../estimates/written-projection";
import { loadExamHistory } from "../view/_utils/exam-history";
import { CGU, CGU_WRITTEN_GRADING } from "./_test-utils/cgu-written";
import { finishMock } from "./finish-mock";
import { getMock } from "./get-mock";
import { getMockOptions } from "./get-mock-options";
import { gradeMockEssays } from "./grade-mock-essays";
import { mockAnswerInputSchema } from "./mock-answer-contract";
import { type MockShape, mockConditionsSchema } from "./mock-contract";
import { listMockPrepWrites } from "./prepare-mock-questions";
import { saveMockAnswer } from "./save-mock-answer";
import { startAnytimeMock } from "./start-anytime-mock";
import { startMock } from "./start-mock";
import { submitMockSection } from "./submit-mock-section";

// Stub the model provider to keep mock grading off the network.
vi.mock("@zoonk/ai/tasks/grading/grade-essay", () => ({ gradeWritingEvidence: vi.fn() }));

const calibration = vi.hoisted(() => ({ current: null as WritingCalibration | null }));

vi.mock(import("../essays/_utils/writing-calibration"), async (importOriginal) => ({
  ...(await importOriginal()),
  get writingCalibration() {
    return calibration.current;
  },
}));

const FULL = { area: null, day: null, kind: "full" } as const;
const WRITTEN = { area: null, day: null, kind: "written" } as const;
const HALF = { area: null, day: null, kind: "half" } as const;
const UTC = { timeZone: "UTC" };
const SESSION_LENGTH_MS = 210 * 60_000;

const EVIDENCE = {
  awards: [],
  criteria: [],
  elements: [],
  errors: [],
  limits: [],
  nextStep: null,
  onTopicQuote: null,
  zeroKind: null,
  zeroQuote: null,
  zeroRuleIndex: null,
};

const PART_MINIMUM = { max: 100, minimum: { unit: "points", value: 50 } } as const;

async function setup({
  objectiveCount = 0,
  plus = true,
  shortOnly = false,
  structure = CGU,
  writtenTestScheduled = false,
} = {}) {
  const [user, blueprint, control, writing] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure }),
    skillFixture(),
    skillFixture(),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId: user.id,
  });

  const date = SESSION_TODAY.toISOString().slice(0, 10);

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: [
        {
          area: "Control",
          lessons: 1,
          name: control.name,
          phase: 0,
          skillId: control.id,
          weight: null,
        },
        {
          area: "Writing",
          lessons: 1,
          name: writing.name,
          phase: 0,
          skillId: writing.id,
          weight: null,
        },
      ],
    },
    ...(writtenTestScheduled && {
      settings: {
        writingSchedule: [
          { date, minutes: 210, tasks: [], test: { day: null, title: "Written test" } },
        ],
      },
    }),
  });

  const tasks = new Map(listWrittenTasks({ structure }).map((task) => [task.key, task]));

  function prompt(taskKey: string) {
    const grading = tasks.get(taskKey)?.grading ?? CGU_WRITTEN_GRADING;
    const points = grading.criteria[0]?.points ?? 1;

    return itemFixture({
      content: {
        context: null,
        keyPoints: ["Apply the rule"],
        question: `Answer the ${taskKey} question`,
        rubric: [{ criterion: "Application", description: "Apply the rule.", points: null }],
        sampleOutline: "Rule then facts",
        writing: {
          aspects: [{ criterionId: "case", description: "Applies the rule", points }],
          assessedSkillIds: [writing.id],
          criteria: [
            { id: "case", name: taskKey === "short" ? "Presentation" : "Application", points },
            ...(taskKey === "short" ? [{ id: "rule", name: "Application", points: null }] : []),
          ],
          grading,
          keySource: "practiceKey",
          lines: taskKey === "short" ? 30 : 60,
          minimumWords: 1,
          partMinimum: PART_MINIMUM,
          points: taskKey === "short" ? 30 : 70,
          taskKey,
          title: `Topic for ${taskKey}`,
          unit: "answer",
        },
      },
      examBlueprintId: blueprint.id,
      format: "essay",
      skillId: writing.id,
    });
  }

  const [short, long, objective] = await Promise.all([
    prompt("short"),
    shortOnly ? null : prompt("long"),
    Promise.all(
      Array.from({ length: objectiveCount }, () =>
        itemFixture({
          content: choiceItemContent(),
          examBlueprintId: blueprint.id,
          mockOnly: true,
          skillId: control.id,
        }),
      ),
    ),
    planItemFixture({ kind: "lesson", planId: plan.id, position: 0, skillId: control.id }),
    plus &&
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
  ]);

  mockSession(user.id);

  return { blueprint, goal, long, objective, prompt, short, user, writing };
}

function useExtraWriting(userId: string) {
  return prisma.writingAdmission.createMany({
    data: Array.from({ length: 6 }, () => ({
      extra: true,
      id: randomUUID(),
      itemIds: [],
      localDate: SESSION_TODAY,
      userId,
    })),
  });
}

async function start(goalId: string, shape: MockShape) {
  const result = await startAnytimeMock({ goalId, input: { shape } });

  if (result.status !== "started") {
    throw new Error(`Expected a new mock, got ${result.status}`);
  }

  return result.id;
}

async function view(id: string) {
  const found = await getMock(id);

  if (found.status !== "ready") {
    throw new Error("Expected the owned sitting");
  }

  return found.mock;
}

function save({
  durationMs = 1000,
  id,
  itemId,
  text,
}: {
  durationMs?: number;
  id: string;
  itemId: string;
  text: string;
}) {
  return saveMockAnswer({
    blockId: id,
    input: { answer: { text }, durationMs, flagged: false, itemId },
  });
}

describe("written mock sittings", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
    vi.mocked(gradeWritingEvidence, { partial: true }).mockResolvedValue({ data: EVIDENCE });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(gradeWritingEvidence).mockReset();

    calibration.current = null;
  });

  it("keeps a newer device's written answer when an offline edit arrives later", async () => {
    const { goal, short } = await setup();
    const id = await start(goal.id, WRITTEN);
    const firstDevice = crypto.randomUUID();
    const secondDevice = crypto.randomUUID();
    const draft = { durationMs: 0, flagged: false, itemId: short.id };

    await expect(
      saveMockAnswer({
        blockId: id,
        input: {
          ...draft,
          answer: { text: "First answer" },
          edit: { order: 0, writer: firstDevice },
        },
      }),
    ).resolves.toStrictEqual({ status: "saved" });

    const initial = await view(id);
    const base = initial.current?.drafts[0]?.revision;
    expect(base).toBeDefined();
    vi.setSystemTime(new Date(SESSION_NOW.getTime() + 5000));

    await expect(
      saveMockAnswer({
        blockId: id,
        input: {
          ...draft,
          answer: { text: "Another device's answer" },
          edit: { base, order: 0, writer: secondDevice },
        },
      }),
    ).resolves.toStrictEqual({ status: "saved" });

    await expect(
      saveMockAnswer({
        blockId: id,
        input: {
          ...draft,
          answer: { text: "Offline edit" },
          edit: { order: 1, writer: firstDevice },
        },
      }),
    ).resolves.toStrictEqual({ status: "staleAnswer" });

    await expect(view(id)).resolves.toMatchObject({
      current: { drafts: [{ answer: { text: "Another device's answer" } }] },
    });
  });

  it.each([FULL, WRITTEN])("prepares a $kind paper missing a written prompt", async (shape) => {
    const { goal, prompt, short, user } = await setup({
      objectiveCount: shape.kind === "full" ? 170 : 0,
      shortOnly: true,
    });

    const options = await getMockOptions({ goalId: goal.id });

    expect(options).toMatchObject({
      status: "ready",
      view: {
        options: [
          { kind: "objective", minutes: 300, questions: 170 },
          { kind: "written", minutes: 210, sections: [{ questions: 2 }] },
          { kind: "full", minutes: 510, sections: [{ questions: 170 }, { questions: 2 }] },
          { kind: "half", minutes: 150, objectiveOnly: true, questions: 85 },
        ],
      },
    });

    const key = JSON.stringify([shape.kind, null, null]);

    await expect(startAnytimeMock({ goalId: goal.id, input: { shape } })).resolves.toStrictEqual({
      status: "preparing",
    });

    await expect(prisma.goal.findUnique({ where: { id: goal.id } })).resolves.toMatchObject({
      requestedMock: { papers: [key], shape },
    });

    await expect(
      prisma.followUp.findFirst({ where: { key: goal.id, kind: "prepareMockSupply" } }),
    ).resolves.toMatchObject({ input: { later: false, paper: key }, userId: user.id });

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { requested: { shape, status: "preparing" } },
    });

    await expect(
      listMockPrepWrites({ goalId: goal.id, only: key, priority: key }),
    ).resolves.toStrictEqual({
      papers: [
        {
          key,
          later: false,
          quickFormat: "multipleChoice",
          writes: [],
          writing: [
            { count: 1, goalId: goal.id, taskKey: "long", unit: "answer", userId: user.id },
          ],
        },
      ],
      urgentShort: true,
    });

    await expect(prisma.mockExam.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.writingAdmission.count({ where: { userId: user.id } })).resolves.toBe(0);

    const long = await prompt("long");

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { requested: { shape, status: "ready" } },
    });

    const id = await start(goal.id, shape);

    await expect(
      prisma.writingAdmission.findMany({ where: { userId: user.id } }),
    ).resolves.toMatchObject([{ extra: true, itemIds: [short.id, long.id] }]);

    await expect(prisma.mockExam.findUnique({ where: { id } })).resolves.toMatchObject({
      conditions: {
        writtenParts: [
          {
            tasks: [
              { itemIds: [short.id], key: "short" },
              { itemIds: [long.id], key: "long" },
            ],
          },
        ],
      },
    });
  });

  it("keeps both notice questions visible and refuses a written test that needs a specialty", async () => {
    const structure: ExamStructure = structuredClone(CGU);
    const written = structure.mock?.sections.find(({ kind }) => kind === "written");
    const control = structure.subjects[0];

    if (!written?.tasks?.[0] || !written.tasks[1] || !control) {
      throw new Error("Expected the two-question notice");
    }

    written.tasks[0].subjects = ["Control"];
    written.tasks[1].subjects = ["Systems", "Accounting"];

    structure.subjects.push(
      { ...control, choiceGroup: "Specialty", name: "Systems", questions: null },
      { ...control, choiceGroup: "Specialty", name: "Accounting", questions: null },
    );

    const { goal, user } = await setup({ shortOnly: true, structure });

    const availability = { choiceGroups: ["Specialty"], status: "needsChoice" };

    await expect(getSyllabusView({ goalId: goal.id })).resolves.toMatchObject({
      syllabus: {
        writtenPractice: {
          subjects: [
            {
              availability,
              minutes: 210,
              questions: 2,
              writeActions: [
                { availability: { status: "available" }, taskKey: "short" },
                { availability, taskKey: "long" },
              ],
            },
          ],
        },
      },
    });

    const options = await getMockOptions({ goalId: goal.id });

    if (options.status !== "ready") {
      throw new Error(options.status);
    }

    expect(options.view.options.find(({ kind }) => kind === "written")).toMatchObject({
      availability,
      minutes: 210,
      sections: [{ availability, questions: 2 }],
    });

    expect(options.view.options.find(({ kind }) => kind === "full")).toMatchObject({
      availability,
      minutes: 510,
      sections: [{ questions: 170 }, { availability, questions: 2 }],
    });

    await useExtraWriting(user.id);

    await expect(
      Promise.all(
        [FULL, WRITTEN].map((shape) => startAnytimeMock({ goalId: goal.id, input: { shape } })),
      ),
    ).resolves.toStrictEqual([availability, availability]);

    await expect(prisma.goal.findUnique({ where: { id: goal.id } })).resolves.toMatchObject({
      requestedMock: null,
    });

    await expect(
      prisma.followUp.count({ where: { kind: "prepareMockSupply", userId: user.id } }),
    ).resolves.toBe(0);

    await expect(listMockPrepWrites({ goalId: goal.id })).resolves.toMatchObject({
      papers: expect.not.arrayContaining([
        expect.objectContaining({ key: JSON.stringify(["written", null, null]) }),
      ]),
    });

    await expect(
      listMockPrepWrites({ goalId: goal.id, only: JSON.stringify(["full", null, null]) }),
    ).resolves.toStrictEqual({ papers: [], urgentShort: false });

    await expect(prisma.writingAdmission.count({ where: { userId: user.id } })).resolves.toBe(6);
  });

  it("cannot be started by a learner without Plus", async () => {
    const { goal, user } = await setup({ plus: false });

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: WRITTEN } }),
    ).resolves.toStrictEqual({ status: "plusRequired" });

    await expect(prisma.writingAdmission.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("starts a written-only mock without overlapping queries on its transaction connection", async () => {
    const { goal } = await setup();

    const { overlaps } = await observeDatabaseQueries(() => start(goal.id, WRITTEN));

    expect(overlaps).toStrictEqual([]);
  });

  it("reuses the running sitting and admits both prompts once, then keeps an opened blank prompt out of the next sitting", async () => {
    const { blueprint, goal, prompt, short, user, writing } = await setup({ shortOnly: true });

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: WRITTEN } }),
    ).resolves.toStrictEqual({ status: "preparing" });

    const long = await prompt("long");
    const id = await start(goal.id, WRITTEN);

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: WRITTEN } }),
    ).resolves.toStrictEqual({ id, status: "running" });

    const admissions = await prisma.writingAdmission.findMany({ where: { userId: user.id } });
    expect(admissions).toMatchObject([{ extra: true, itemIds: [short.id, long?.id] }]);
    const stored = await prisma.mockExam.findUniqueOrThrow({ where: { id } });

    expect(mockConditionsSchema.parse(stored.conditions).writingAdmissionId).toBe(
      admissions[0]?.id,
    );

    await expect(view(id)).resolves.toMatchObject({
      current: {
        questionTotal: 2,
        questions: [
          { itemId: short.id, number: 1, writing: { taskKey: "short" } },
          { itemId: long?.id, number: 2, writing: { taskKey: "long" } },
        ],
      },
      minutes: 210,
      questions: 0,
      shape: WRITTEN,
    });

    await expect(gradeMockEssays({ blockId: id, input: UTC })).resolves.toStrictEqual({
      status: "notFinished",
    });

    expect(gradeWritingEvidence).not.toHaveBeenCalled();

    const text = `  ${"Legal argument. ".repeat(900)}\n  End of the answer.  `;
    const cut = text.indexOf("Legal") + 30 * WRITING_MAX_CHARACTERS_PER_LINE;

    const input = mockAnswerInputSchema.parse({
      answer: { text },
      durationMs: SESSION_LENGTH_MS,
      flagged: true,
      itemId: short.id,
    });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + 5000));

    await expect(saveMockAnswer({ blockId: id, input })).resolves.toStrictEqual({
      status: "saved",
    });

    await expect(
      prisma.mockExamAnswer.findFirst({ where: { itemId: short.id, mockExamId: id } }),
    ).resolves.toMatchObject({ durationMs: 5000 });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + SESSION_LENGTH_MS - 1000));
    await submitMockSection({ blockId: id, input: UTC, section: 0 });

    await expect(view(id)).resolves.toMatchObject({
      essays: [
        { status: "pending", text, unsure: true },
        { status: "blank", text: null, unsure: false },
      ],
      result: { points: { written: [{ range: null, standing: "unmeasured" }] }, total: 0 },
      status: "finished",
    });

    expect(gradeWritingEvidence).not.toHaveBeenCalled();

    vi.mocked(gradeWritingEvidence, { partial: true }).mockResolvedValueOnce({
      data: {
        ...EVIDENCE,
        awards: [{ award: 3, quote: null, row: 0 }],
        criteria: [{ comment: "Applies the rule", example: null, id: "rule", quote: null }],
      },
    });

    await expect(gradeMockEssays({ blockId: id, input: UTC })).resolves.toStrictEqual({
      status: "graded",
    });

    await gradeMockEssays({ blockId: id, input: UTC });

    expect(gradeWritingEvidence).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ text: text.slice(0, cut) }),
    );

    await expect(view(id)).resolves.toMatchObject({
      essays: [
        {
          grade: {
            estimatedLines: 167,
            ignoredFrom: cut,
            kind: "levels",
            nextStep: { kind: "limit", title: null },
          },
          status: "graded",
          unsure: true,
          writing: { partMinimum: PART_MINIMUM },
        },
        { grade: null, status: "blank" },
      ],
    });

    await expect(
      loadWrittenProjection({
        goalId: goal.id,
        objective: { calibrated: false, high: 82, low: 76, mocks: 1, scale: "percent" },
        structure: CGU,
        userId: user.id,
      }),
    ).resolves.toMatchObject({
      combined: null,
      objective: { high: 82, low: 76 },
      parts: [
        {
          minimum: { unit: "points", value: 50 },
          range: null,
          scale: "levels",
          standing: "unmeasured",
          tasks: [
            { key: "short", range: null },
            { key: "long", range: null },
          ],
        },
      ],
    });

    await expect(getSyllabusView({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
      syllabus: {
        writtenPractice: {
          subjects: [
            {
              answers: [
                {
                  estimatedLines: 167,
                  range: null,
                  taskKey: "short",
                  title: "Topic for short",
                  unit: "answer",
                  versions: 1,
                },
              ],
              minutes: 210,
              points: { standing: "unmeasured" },
              questions: 2,
              share: 0.5,
              trend: [{ contentShare: 1, errors: 0, presentationShare: 0 }],
            },
          ],
        },
      },
    });

    await expect(
      prisma.attempt.count({ where: { mockExamId: id, userId: user.id } }),
    ).resolves.toBe(1);

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: WRITTEN } }),
    ).resolves.toStrictEqual({ status: "preparing" });

    const attempt = await prisma.attempt.findFirstOrThrow({
      where: { itemId: short.id, mockExamId: id, userId: user.id },
    });

    async function readHistory() {
      const [syllabus, detail, projection, samples, finished, history, evidence] =
        await Promise.all([
          getSyllabusView({ goalId: goal.id }),
          getWritingAttempt(attempt.id),
          loadWrittenProjection({
            goalId: goal.id,
            objective: null,
            structure: CGU,
            userId: user.id,
          }),
          loadWrittenSamples({
            scope: { examBlueprintId: goal.examBlueprintId, firstDraft: true, wholeAnswers: true },
            userId: user.id,
          }),
          view(id),
          loadExamHistory({ goalId: goal.id, today: new Date() }),
          loadWritingEvidence({
            examBlueprintId: blueprint.id,
            skillIds: new Set([writing.id]),
            tx: prisma,
            userId: user.id,
          }),
        ]);

      return {
        detail,
        evidence,
        history:
          syllabus.status === "ready" &&
          syllabus.syllabus.writtenPractice?.subjects?.map(({ answers, trend }) => ({
            answers,
            trend,
          })),
        mock: { essays: finished.essays, written: finished.result?.points?.written },
        mockHistory: history.mocks,
        projection,
        samples,
      };
    }

    const before = await readHistory();

    expect(before).toMatchObject({
      detail: { attempt: { writingTask: { lines: 30, number: 1, total: 2 } }, status: "ready" },
      evidence: [{ attemptId: attempt.id, kind: "writing", skillId: writing.id }],
      mock: {
        essays: [{ itemId: short.id, status: "graded" }, { status: "blank" }],
        written: [{ name: "Written test" }],
      },
      mockHistory: [{ blockId: id }],
      samples: [{ id: attempt.id, itemId: short.id }],
    });

    const gradedContent = readEssayContent(short);

    if (!gradedContent) {
      throw new Error("Expected the graded essay prompt.");
    }

    await prisma.item.update({
      data: {
        content: {
          ...gradedContent,
          context: "Revised context",
          question: "Revised question",
          writing: { ...gradedContent.writing, title: "Updated prompt", unit: "drill" },
        },
        examBlueprintId: null,
      },
      where: { id: short.id },
    });

    const afterEdit = await readHistory();

    await prisma.item.delete({ where: { id: short.id } });

    await expect(prisma.attempt.findUnique({ where: { id: attempt.id } })).resolves.toMatchObject({
      itemId: null,
    });

    expect([afterEdit, await readHistory()]).toStrictEqual([before, before]);

    const corrected = structuredClone(CGU);
    const section = corrected.mock?.sections.find(({ kind }) => kind === "written");
    const task = section?.tasks?.[0];

    if (!section || !task) {
      throw new Error("Expected the original task");
    }

    task.key = "corrected";

    await prisma.examBlueprint.update({
      data: { structure: corrected },
      where: { id: blueprint.id },
    });

    const afterCorrection = await readHistory();
    expect(afterCorrection.history).toStrictEqual(before.history);
    expect(afterCorrection.detail).toStrictEqual(before.detail);
    expect(afterCorrection.mock).toStrictEqual(before.mock);
    expect(afterCorrection.mockHistory).toStrictEqual(before.mockHistory);
    expect(afterCorrection.evidence).toStrictEqual(before.evidence);
    section.name = "Replacement written part";

    await prisma.examBlueprint.update({
      data: { structure: corrected },
      where: { id: blueprint.id },
    });

    const afterPartRemoval = await readHistory();
    expect(afterPartRemoval.history).toStrictEqual([{ answers: [], trend: [] }]);
    expect(afterPartRemoval.detail).toMatchObject({ status: "ready" });
  });

  it("starts a full mock with both assigned essays, and retries a failed answer without regrading the saved answer", async () => {
    const { goal, long, short } = await setup({ objectiveCount: 170 });
    const id = await start(goal.id, FULL);
    const started = await view(id);

    expect(started.sections).toMatchObject([
      { questions: 170 },
      { essays: 2, minutes: 210, questions: 0 },
    ]);

    await expect(save({ id, itemId: short.id, text: "Too early" })).resolves.toStrictEqual({
      status: "invalidItem",
    });

    const objectiveId = started.current?.questions[0]?.itemId ?? "";

    await expect(
      save({ id, itemId: objectiveId, text: "Not an objective answer" }),
    ).resolves.toStrictEqual({ status: "invalidItem" });

    await expect(
      saveMockAnswer({
        blockId: id,
        input: {
          answer: { selectedIndex: 0 },
          durationMs: 1000,
          flagged: true,
          itemId: objectiveId,
        },
      }),
    ).resolves.toStrictEqual({ status: "saved" });

    await submitMockSection({ blockId: id, input: UTC, section: 0 });

    await expect(view(id)).resolves.toMatchObject({
      current: {
        questions: [
          { format: "essay", itemId: short.id, writing: { taskKey: "short" } },
          { format: "essay", itemId: long?.id, writing: { taskKey: "long" } },
        ],
      },
    });

    await expect(
      saveMockAnswer({
        blockId: id,
        input: { answer: { selectedIndex: 0 }, durationMs: 1000, flagged: false, itemId: short.id },
      }),
    ).resolves.toStrictEqual({ status: "invalidItem" });

    await save({ id, itemId: short.id, text: "Short answer" });
    await save({ id, itemId: long?.id ?? "", text: "Long answer" });
    await submitMockSection({ blockId: id, input: UTC, section: 1 });

    await expect(view(id)).resolves.toMatchObject({
      essays: [{ status: "pending" }, { status: "pending" }],
      result: { total: 170 },
      status: "finished",
    });

    expect(gradeWritingEvidence).not.toHaveBeenCalled();

    vi.mocked(gradeWritingEvidence).mockRejectedValueOnce(new Error("Provider unavailable"));

    await expect(gradeMockEssays({ blockId: id, input: UTC })).rejects.toThrow(
      "Provider unavailable",
    );

    await expect(view(id)).resolves.toMatchObject({
      essays: [{ status: "pending" }, { status: "graded" }],
    });

    await expect(gradeMockEssays({ blockId: id, input: UTC })).resolves.toStrictEqual({
      status: "graded",
    });

    expect(gradeWritingEvidence).toHaveBeenCalledTimes(3);

    const graded = await view(id);
    expect(graded.essays).toMatchObject([{ status: "graded" }, { status: "graded" }]);
    expect(graded.review.map(({ itemId }) => itemId)).toContain(objectiveId);
    expect(graded.review.map(({ itemId }) => itemId)).not.toContain(short.id);
    expect(graded.review.map(({ itemId }) => itemId)).not.toContain(long?.id);
  });

  it("sits an exam with only a written test as a full mock", async () => {
    const structure = structuredClone(CGU);

    if (!structure.mock) {
      throw new Error("Expected an exam notice");
    }

    structure.mock.sections = structure.mock.sections.filter(({ kind }) => kind === "written");
    structure.mock.timeLimitMinutes = 210;
    structure.mock.totalQuestions = null;
    structure.subjects = structure.subjects.filter(({ name }) => name === "Writing");

    const { goal, short } = await setup({ structure });
    const id = await start(goal.id, FULL);

    await expect(view(id)).resolves.toMatchObject({
      current: { questions: [{ format: "essay" }, { format: "essay" }] },
      sections: [{ essays: 2, minutes: 210, questions: 0 }],
      shape: FULL,
    });

    await save({ id, itemId: short.id, text: "Answer to the written test" });
    await submitMockSection({ blockId: id, input: UTC, section: 0 });

    await expect(view(id)).resolves.toMatchObject({
      essays: [{ itemId: short.id, status: "pending", unsure: false }, { status: "blank" }],
      result: { total: 0 },
      status: "finished",
    });
  });

  it("retains saved scores while measuring only tasks in the current projection", async () => {
    const numeric = structuredClone(CGU);
    const section = numeric.mock?.sections.find(({ kind }) => kind === "written");

    if (!section?.tasks) {
      throw new Error("Expected the written tasks");
    }

    const provenance = {
      generatedAt: SESSION_NOW.toISOString(),
      latencyMs: 1,
      model: "fixture/model",
      promptVersion: "fixture-revision",
      provider: "fixture",
      requestedModel: "fixture/model",
      runId: "fixture",
      usage: {},
    };

    for (const task of section.tasks) {
      const points = task.points ?? null;

      const grading = {
        ...CGU_WRITTEN_GRADING,
        criteria: CGU_WRITTEN_GRADING.criteria.map((criterion) => ({ ...criterion, points })),
      };

      task.grading = grading;
    }

    calibration.current = calibrationFixture({
      grader: { model: provenance.model, promptVersion: provenance.promptVersion },
      rows: {
        definitePoint: rowCalibrationFixture({
          residuals: {
            over: weightedResiduals([0, 0, 0, 0]),
            under: weightedResiduals([0, 0, 0, 0]),
          },
        }),
      },
    });

    const { blueprint, goal, long, short, user } = await setup({ structure: numeric });
    const text = "The rule applies to this case.";

    vi.mocked(gradeWritingEvidence, { partial: true }).mockResolvedValue({
      data: {
        ...EVIDENCE,
        awards: [
          { award: 1, quote: text, row: 0 },
          { award: 1, quote: text, row: 1 },
        ],
      },
      provenance,
    });

    if (!long) {
      throw new Error("Expected the long essay prompt");
    }

    const id = await start(goal.id, WRITTEN);
    await expect(save({ id, itemId: short.id, text })).resolves.toMatchObject({ status: "saved" });
    await expect(save({ id, itemId: long.id, text })).resolves.toMatchObject({ status: "saved" });
    await submitMockSection({ blockId: id, input: UTC, section: 0 });

    await expect(gradeMockEssays({ blockId: id, input: UTC })).resolves.toMatchObject({
      status: "graded",
    });

    async function readScores(structure: ExamStructure) {
      const [mock, projection, syllabus] = await Promise.all([
        view(id),
        loadWrittenProjection({ goalId: goal.id, objective: null, structure, userId: user.id }),
        getSyllabusView({ goalId: goal.id }),
      ]);

      return {
        history:
          syllabus.status === "ready" && syllabus.syllabus.writtenPractice?.subjects?.[0]?.answers,
        projection: projection?.parts[0]?.tasks,
        standing: projection?.parts[0]?.standing,
        written: mock.result?.points?.written,
      };
    }

    const before = await readScores(numeric);
    const range = { high: 30, low: 30 };
    const longRange = { high: 70, low: 70 };

    expect(before).toMatchObject({
      history: expect.arrayContaining([
        expect.objectContaining({ range }),
        expect.objectContaining({ range: longRange }),
      ]),
      projection: [
        { key: "short", range },
        { key: "long", range: longRange },
      ],
      standing: "met",
      written: [
        {
          range: { high: 100, low: 100 },
          standing: "met",
          tasks: [
            { key: "short", range },
            { key: "long", range: longRange },
          ],
        },
      ],
    });

    const content = readEssayContent(short);

    if (!content) {
      throw new Error("Expected the graded essay prompt");
    }

    await prisma.item.update({
      data: { content: { ...content, writing: { ...content.writing, points: 12 } } },
      where: { id: short.id },
    });

    await expect(readScores(numeric)).resolves.toStrictEqual(before);

    await prisma.item.delete({ where: { id: short.id } });
    await expect(readScores(numeric)).resolves.toStrictEqual(before);

    const sitting = await prisma.mockExam.findFirstOrThrow({
      where: { goalId: goal.id, status: "finished" },
    });

    const latest = await prisma.mockExam.create({
      data: {
        conditions: sitting.conditions ?? {},
        examBlueprintId: blueprint.id,
        goalId: goal.id,
        sectionStartedAt: SESSION_NOW,
        userId: user.id,
      },
    });

    await expect(readScores(numeric)).resolves.toStrictEqual(before);

    await prisma.mockExam.update({
      data: { finishedAt: new Date(SESSION_NOW.getTime() + 1), status: "finished" },
      where: { id: latest.id },
    });

    await expect(readScores(numeric)).resolves.toStrictEqual({ ...before, standing: "unmeasured" });

    const structure = structuredClone(numeric);
    const task = structure.mock?.sections.find(({ kind }) => kind === "written")?.tasks?.[0];

    if (!task) {
      throw new Error("Expected the original task");
    }

    task.key = "corrected";
    await prisma.examBlueprint.update({ data: { structure }, where: { id: blueprint.id } });

    await expect(readScores(structure)).resolves.toMatchObject({
      history: before.history,
      projection: [
        { key: "corrected", range: null },
        { key: "long", range: longRange },
      ],
      written: before.written,
    });
  });

  it("keeps short results out of the goal's written projection and preserves the objective answer cap", async () => {
    const { blueprint, goal, objective, user } = await setup({ objectiveCount: 85 });
    const id = await start(goal.id, HALF);
    const sitting = await view(id);
    const itemId = sitting.current?.questions[0]?.itemId ?? objective[0]?.id ?? "";

    await expect(
      saveMockAnswer({
        blockId: id,
        input: {
          answer: { selectedIndex: 0 },
          durationMs: SESSION_LENGTH_MS,
          flagged: false,
          itemId,
        },
      }),
    ).resolves.toStrictEqual({ status: "invalidItem" });

    await finishMock({ blockId: id, input: UTC });

    const projection = await loadGoalWrittenProjection({
      blueprint,
      examPart: false,
      goal,
      structure: CGU,
      userId: user.id,
    });

    expect(projection).toMatchObject({
      combined: null,
      objective: null,
      parts: [{ standing: "unmeasured" }],
    });
  });

  it("refuses extra writing before start but admits a scheduled written test despite the extra limit", async () => {
    const { goal, prompt, short, user } = await setup({
      shortOnly: true,
      writtenTestScheduled: true,
    });

    await useExtraWriting(user.id);

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: WRITTEN } }),
    ).resolves.toMatchObject({ status: "limitReached" });

    await expect(prisma.mockExam.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(prisma.goal.findUnique({ where: { id: goal.id } })).resolves.toMatchObject({
      requestedMock: null,
    });

    await expect(
      prisma.followUp.count({ where: { kind: "prepareMockSupply", userId: user.id } }),
    ).resolves.toBe(0);

    const session = await prisma.studySession.create({
      data: {
        goalId: goal.id,
        localDate: SESSION_TODAY,
        missions: [],
        plannedMinutes: 210,
        userId: user.id,
      },
    });

    const block = await prisma.studySessionBlock.create({
      data: {
        estimatedMinutes: 210,
        kind: "checkpoint",
        payload: {
          checkpoint: {
            kind: "weekly",
            mock: true,
            mockIdentity: { day: null, fullLength: false },
            passMark: 0,
            phase: null,
            timeLimitMinutes: 210,
            written: true,
          },
        },
        position: 0,
        sessionId: session.id,
      },
    });

    const paper = SESSION_TODAY.toISOString();

    await expect(startMock({ blockId: block.id, input: UTC })).resolves.toStrictEqual({
      status: "preparing",
    });

    await expect(prisma.mockExam.count({ where: { blockId: block.id } })).resolves.toBe(0);

    await expect(
      prisma.writingAdmission.count({ where: { extra: false, userId: user.id } }),
    ).resolves.toBe(0);

    await expect(
      prisma.followUp.findFirst({ where: { key: goal.id, kind: "prepareMockSupply" } }),
    ).resolves.toMatchObject({ input: { later: false, paper } });

    await expect(
      listMockPrepWrites({ goalId: goal.id, only: paper, priority: paper }),
    ).resolves.toMatchObject({
      papers: [
        {
          key: paper,
          writes: [],
          writing: [
            { count: 1, goalId: goal.id, taskKey: "long", unit: "answer", userId: user.id },
          ],
        },
      ],
    });

    const long = await prompt("long");

    const { overlaps, result } = await observeDatabaseQueries(() =>
      startMock({ blockId: block.id, input: UTC }),
    );

    expect(result).toStrictEqual({ status: "ready" });
    expect(overlaps).toStrictEqual([]);

    await expect(view(block.id)).resolves.toMatchObject({
      minutes: 210,
      questions: 0,
      shape: WRITTEN,
    });

    await expect(
      prisma.writingAdmission.findMany({ where: { extra: false, userId: user.id } }),
    ).resolves.toMatchObject([{ itemIds: [short.id, long.id] }]);

    await expect(
      prisma.mockExam.findUnique({ where: { blockId: block.id } }),
    ).resolves.toMatchObject({
      conditions: {
        writtenParts: [
          {
            tasks: [
              { itemIds: [short.id], key: "short" },
              { itemIds: [long.id], key: "long" },
            ],
          },
        ],
      },
    });
  });
});
