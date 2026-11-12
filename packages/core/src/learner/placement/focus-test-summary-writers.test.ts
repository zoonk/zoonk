import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import {
  holdLearnerLock,
  holdPlanLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { mockSession } from "../../_test-utils/mock-session";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import { buildExamIdentityKey } from "../../library/exams/exam-identity";
import {
  linkGoalToExamBlueprint,
  refreshFollowerSummaries,
  unlinkGoalFromSharedExam,
} from "../../library/exams/exam-learners";
import {
  findChoiceOptionsLookup,
  recordChoiceOptions,
} from "../../library/exams/record-choice-options";
import {
  findSubjectQuestionsLookup,
  recordSubjectQuestions,
} from "../../library/exams/record-subject-questions";
import { readBlueprintContent, saveExamBlueprint } from "../../library/exams/save-exam-blueprint";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { getPlanTimeAdvice } from "../../plans/get-time-advice";
import { refreshGoalPlan } from "../../plans/refresh-goal-plan";
import { openStudyDay } from "../../sessions/open-study-day";
import { saveAnswerInputs } from "../../view-models/onboarding/_utils/save-onboarding-answer";
import { answerOnboardingQuestion } from "../../view-models/onboarding/answer-onboarding-question";
import { PLAN_SHOWN, shortPlanExamGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { loadPlacementPlan } from "../_utils/goal-skill-graph";
import { loadPlacementWithSummary } from "./_utils/load-placement-state";
import { startFocusTestSummary } from "./_utils/settle-focus-test";
import { answerPlacementQuestion } from "./answer-placement-question";
import { readFocusTestRecord } from "./focus-test-state";

const PLAN_LOCK = /FOR UPDATE OF plan/u;
/** A plan write locks its learners as a list, other learner writes lock one. */
const LEARNER_LOCK = /FROM users\s+WHERE id/u;
const ALL_BUT_DIREITO = ["Português", "Informática", "Raciocínio", "Atualidades", "Ética"];

const WRITTEN_PORTUGUES: ExamStructure["mock"] = {
  adaptive: false,
  citations: [],
  order: null,
  scoring: { description: "", method: "raw" },
  sections: [{ day: 1, kind: "written", minutes: 30, name: "Português", questions: 1 }],
  timeLimitMinutes: 30,
  totalQuestions: 1,
};

async function readSummary(goalId: string) {
  return readFocusTestRecord(await prisma.goal.findUniqueOrThrow({ where: { id: goalId } }))
    ?.summary;
}

async function computeSummary({ id, userId }: { id: string; userId: string }) {
  const plan = await loadPlacementPlan(id);
  const read = await loadPlacementWithSummary({ goalId: id, plan, userId });
  return read.focusTest?.summary;
}

async function editAreas(goalId: string, kind: "restoreAreas" | "skipAreas", areas: string[]) {
  return changeGoalPlan({ goalId, input: { operations: [{ areas, kind }] } });
}

async function optionalBlueprint(blueprintId: string, options: string[]) {
  const blueprint = await prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprintId } });
  const structure = examStructureSchema.parse(blueprint.structure);

  return {
    structure: {
      ...structure,
      subjects: structure.subjects.map((subject) =>
        options.includes(subject.name) ? { ...subject, choiceGroup: "Option" } : subject,
      ),
    },
  };
}

/**
 * A personal plan with a Focus test summary, whose notice research finds later. The notice makes
 * Português, which the plan studies, and Espanhol, which it doesn't, options of one group.
 */
async function laterOptionNotice({
  details = {},
  goal,
  mock,
}: {
  details?: Record<string, unknown>;
  goal: { examBlueprintId: string | null; id: string };
  mock?: ExamStructure["mock"];
}) {
  const blueprintId = goal.examBlueprintId ?? "";
  const optional = await optionalBlueprint(blueprintId, ["Português"]);
  const [first] = optional.structure.subjects;

  await prisma.goal.update({
    data: { details: { ...PLAN_SHOWN.details, ...details }, examBlueprintId: null },
    where: { id: goal.id },
  });

  await startFocusTestSummary(goal.id);

  await prisma.examBlueprint.update({
    data: {
      structure: {
        ...optional.structure,
        ...(mock && { mock }),
        subjects: [
          ...optional.structure.subjects,
          ...(first ? [{ ...first, choiceGroup: "Option", name: "Espanhol" }] : []),
        ],
      },
    },
    where: { id: blueprintId },
  });

  return blueprintId;
}

async function answerDontKnow(goalId: string) {
  const sitting = await startSitting(goalId);

  return answerPlacementQuestion({
    goalId,
    input: { answer: { dontKnow: true }, durationMs: 30_000, itemId: sitting.next?.itemId ?? "" },
  });
}

function setTargetDate(goalId: string, targetDate: string | null) {
  return changeGoalPlan({ goalId, input: { operations: [{ kind: "setTargetDate", targetDate }] } });
}

function openToday(goalId: string) {
  return openStudyDay({
    goalId,
    shownDate: new Date().toISOString().slice(0, 10),
    timeZone: "UTC",
  });
}

/** The learner's next Start, with a review due so the day has something to open. */
async function startNextDay({ id, userId }: { id: string; userId: string }) {
  const { graph } = await prisma.plan.findUniqueOrThrow({ where: { goalId: id } });
  const skillId = (graph as { skills: { skillId: string }[] }).skills[0]?.skillId ?? "";

  await learnerSkillFixture({
    due: new Date(Date.now() - 60 * 60 * 1000),
    lastReviewedAt: new Date(Date.now() - MS_PER_DAY),
    reps: 2,
    skillId,
    state: "learning",
    userId,
  });

  return openToday(id);
}

async function nameSubjectsShortWithoutRefresh(blueprintId: string) {
  const blueprint = await prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprintId } });
  const structure = examStructureSchema.parse(blueprint.structure);

  await prisma.examBlueprint.update({
    data: {
      structure: {
        ...structure,
        subjects: structure.subjects.map((subject) => ({
          ...subject,
          shortName: `${subject.name} (short)`,
        })),
      },
    },
    where: { id: blueprint.id },
  });
}

function expectShortNames(summary: Awaited<ReturnType<typeof readSummary>>) {
  expect(summary?.suggested.length).toBeGreaterThan(0);

  expect(summary?.suggested.map(({ shortName }) => shortName)).toStrictEqual(
    summary?.suggested.map(({ name }) => `${name} (short)`),
  );
}

/**
 * An exam plan with two topics in A and one in B, short of time, that a learner answered: right
 * once on A's first topic, "I don't know" on the others. Focusing a part of A asks its topic twice.
 */
async function focusedPartGoal() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: "A", lessons: 4 },
      { area: "A", lessons: 4 },
      { area: "B", lessons: 4 },
    ],
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 5,
    kind: "exam",
    targetDate: new Date(Date.now() + 5 * MS_PER_DAY),
    userId: user.id,
    ...PLAN_SHOWN,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const focusPart = (index: number, minutes: number) =>
    changeGoalPlan({
      goalId: goal.id,
      input: {
        operations: [
          {
            areas: ["A"],
            kind: "focusAreas",
            parts: [
              { area: "A", name: `Part ${index}`, skillIds: [library.skills[index]?.id ?? ""] },
            ],
          },
          { kind: "setDailyMinutes", minutes },
        ],
      },
    });

  await expect(focusPart(0, 6)).resolves.toMatchObject({ status: "applied" });

  await Promise.all(
    library.skills.map(async (skill, index) => {
      const item = await itemFixture({ format: "numeric", skillId: skill.id });

      await attemptFixture({
        answer: index === 0 ? { value: 42 } : { dontKnow: true },
        durationMs: 30_000,
        isCorrect: index === 0,
        isPlacement: true,
        itemId: item.id,
        skillId: skill.id,
        userId: user.id,
      });
    }),
  );

  await startFocusTestSummary(goal.id);
  return { focusPart, goal };
}

describe("the saved Focus test summary", () => {
  it("counts a subject restored while an answer waited for the plan", async () => {
    const { goal, plan } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });

    await expect(editAreas(goal.id, "skipAreas", ALL_BUT_DIREITO)).resolves.toMatchObject({
      status: "applied",
    });

    const sitting = await startSitting(goal.id);
    const held = holdPlanLock({ planId: plan.id });
    const pid = await held.pid;
    const restored = Promise.allSettled([editAreas(goal.id, "restoreAreas", ["Português"])]);
    const answers: Promise<unknown>[] = [];

    try {
      await waitForBlockedStatement(pid, PLAN_LOCK);

      answers.push(
        Promise.allSettled([
          answerPlacementQuestion({
            goalId: goal.id,
            input: {
              answer: { dontKnow: true },
              durationMs: 30_000,
              itemId: sitting.next?.itemId ?? "",
            },
          }),
        ]),
      );

      await waitForBlockedStatement(pid, PLAN_LOCK, 2);
    } finally {
      held.release();
      await held.done;
    }

    await expect(restored).resolves.toMatchObject([
      { status: "fulfilled", value: { status: "applied" } },
    ]);

    await expect(Promise.all(answers)).resolves.toMatchObject([
      [{ status: "fulfilled", value: { status: "ready" } }],
    ]);

    const summary = await readSummary(goal.id);
    expect(summary).toMatchObject({ asked: 1, complete: false, total: 2, unasked: 1 });
    expect(summary).toStrictEqual(await computeSummary(goal));
  });

  it("counts a subject edit that waited while the first summary was written", async () => {
    const { goal, user } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });
    await prisma.goal.update({ data: { details: PLAN_SHOWN.details }, where: { id: goal.id } });

    const held = holdLearnerLock({ userId: user.id });
    const pid = await held.pid;
    const started = Promise.allSettled([startFocusTestSummary(goal.id)]);
    const edits: Promise<unknown>[] = [];

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
      edits.push(Promise.allSettled([editAreas(goal.id, "skipAreas", ALL_BUT_DIREITO)]));
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      held.release();
      await held.done;
    }

    await expect(started).resolves.toMatchObject([{ status: "fulfilled" }]);

    await expect(Promise.all(edits)).resolves.toMatchObject([
      [{ status: "fulfilled", value: { status: "applied" } }],
    ]);

    const summary = await readSummary(goal.id);
    expect(summary).toMatchObject({ quick: 1, total: 1, unasked: 1 });
    expect(summary).toStrictEqual(await computeSummary(goal));
  });

  it("counts the subject a Start's plan save adds after an exam choice", async () => {
    const { goal, user } = await shortPlanExamGoalFixture({
      goal: { ...PLAN_SHOWN, dailyMinutes: 30 },
    });

    await prisma.examBlueprint.update({
      data: await optionalBlueprint(goal.examBlueprintId ?? "", ["Português", "Informática"]),
      where: { id: goal.examBlueprintId ?? "" },
    });

    await refreshGoalPlan({ goalId: goal.id, mode: "forced" });
    await startSitting(goal.id);

    await prisma.planItem.updateMany({
      data: { status: "done" },
      where: { kind: { in: ["chapter", "lesson"] }, plan: { goalId: goal.id } },
    });

    // The onboarding request ends after its answer and before its re-plan.
    await expect(
      saveAnswerInputs({
        goal: await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
        input: { choices: [{ group: "Option", subjects: ["Português"] }], question: "examChoice" },
      }),
    ).resolves.toMatchObject({ status: "saved" });

    await expect(startNextDay({ id: goal.id, userId: user.id })).resolves.toMatchObject({
      status: "opened",
    });

    const summary = await readSummary(goal.id);
    expect(summary).toMatchObject({ quick: 5, total: 5, unasked: 5 });
    expect(summary).toStrictEqual(await computeSummary(goal));
  });

  it("follows the notice research links or unlinks, with the option it names", async () => {
    const { goal } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });

    const blueprintId = await laterOptionNotice({
      details: { targetPosition: "Português" },
      goal,
      mock: WRITTEN_PORTUGUES,
    });

    await expect(
      linkGoalToExamBlueprint({ examBlueprintId: blueprintId, goalId: goal.id }),
    ).resolves.toBe(true);

    const linked = await readSummary(goal.id);
    expect(linked).toMatchObject({ offerQuestions: 15, quick: 5, total: 6, unasked: 5 });
    expect(linked).toStrictEqual(await computeSummary(goal));

    await unlinkGoalFromSharedExam(goal.id);

    const unlinked = await readSummary(goal.id);
    expect(unlinked).toMatchObject({ quick: 6, total: 6, unasked: 6 });
    expect(unlinked).toStrictEqual(await computeSummary(goal));
  });

  it("counts the option an onboarding answer picks when the plan already studies it", async () => {
    const { goal } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });
    const blueprintId = await laterOptionNotice({ goal });

    await expect(
      linkGoalToExamBlueprint({ examBlueprintId: blueprintId, goalId: goal.id }),
    ).resolves.toBe(true);

    await expect(answerDontKnow(goal.id)).resolves.toMatchObject({ status: "ready" });

    await expect(
      answerOnboardingQuestion({
        goalId: goal.id,
        input: { choices: [{ group: "Option", subjects: ["Português"] }], question: "examChoice" },
      }),
    ).resolves.toMatchObject({ status: "saved" });

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: { focusTest: { subjects: { asked: 1, total: 6 } } },
      status: "ready",
    });

    const summary = await readSummary(goal.id);
    expect(summary).toStrictEqual(await computeSummary(goal));
  });

  it("weighs subjects by the past questions research finds after the test began", async () => {
    const { goal } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });
    const blueprintId = goal.examBlueprintId ?? "";
    const blueprint = await prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprintId } });

    await prisma.examBlueprint.update({
      data: {
        structure: { ...examStructureSchema.parse(blueprint.structure), pastQuestions: null },
      },
      where: { id: blueprintId },
    });

    await expect(answerDontKnow(goal.id)).resolves.toMatchObject({ status: "ready" });

    const lookup = await findSubjectQuestionsLookup({ examBlueprintId: blueprintId });
    const subjects = lookup?.subjects ?? [];

    await recordSubjectQuestions({
      board: null,
      edition: null,
      examBlueprintId: blueprintId,
      questions: subjects.map((name) => (name === "Ética" ? 95 : 1)),
      source: { title: "Previous paper", url: "https://example.com/previous-paper" },
      subjects,
    });

    await refreshFollowerSummaries(blueprintId);

    const summary = await computeSummary(goal);
    expect(summary?.suggested[0]).toMatchObject({ name: "Ética" });
    await expect(readSummary(goal.id)).resolves.toStrictEqual(summary);

    await expect(getPlanTimeAdvice({ goalId: goal.id, input: {} })).resolves.toMatchObject({
      advice: {
        focusSubjects: summary?.suggested.map(({ name, shortName }) => ({ name, shortName })),
      },
      status: "ready",
    });
  });

  it("suggests subjects to focus only while the goal has an exam date", async () => {
    const { goal } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });
    await expect(answerDontKnow(goal.id)).resolves.toMatchObject({ status: "ready" });
    const dated = await readSummary(goal.id);
    expect(dated?.suggested.length).toBeGreaterThan(0);

    await expect(setTargetDate(goal.id, null)).resolves.toMatchObject({ status: "applied" });
    const undated = await readSummary(goal.id);
    expect(undated?.suggested).toStrictEqual([]);
    expect(undated).toStrictEqual(await computeSummary(goal));

    const date = new Date(Date.now() + 30 * MS_PER_DAY).toISOString().slice(0, 10);
    await expect(setTargetDate(goal.id, date)).resolves.toMatchObject({ status: "applied" });
    const redated = await readSummary(goal.id);
    expect(redated?.suggested).toStrictEqual(dated?.suggested);
    expect(redated).toStrictEqual(await computeSummary(goal));
  });

  it("counts a subject a notice read again tests in writing by the learner's next Start", async () => {
    const { goal, user } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });
    await expect(answerDontKnow(goal.id)).resolves.toMatchObject({ status: "ready" });
    await expect(readSummary(goal.id)).resolves.toMatchObject({ quick: 6, total: 6 });

    const identity = {
      board: null,
      country: "BR",
      language: "en",
      name: `Concurso ${randomUUID()}`,
      ownerId: null,
      role: null,
    };

    const [blueprint, source] = await Promise.all([
      prisma.examBlueprint.update({
        data: { identityKey: buildExamIdentityKey(identity), name: identity.name },
        where: { id: goal.examBlueprintId ?? "" },
      }),
      sourceFixture(),
    ]);

    const content = readBlueprintContent(blueprint);

    await saveExamBlueprint({
      content: {
        ...content,
        edition: { ...content.edition, sourceHash: source.contentHash },
        structure: { ...content.structure, mock: WRITTEN_PORTUGUES },
      },
      identity,
      provenance: {
        generatedAt: new Date(),
        model: "test/fixture",
        promptVersion: "test",
        runId: randomUUID(),
      },
      sourceId: source.id,
    });

    await expect(startNextDay({ id: goal.id, userId: user.id })).resolves.toMatchObject({
      status: "opened",
    });

    const summary = await readSummary(goal.id);
    expect(summary).toMatchObject({ quick: 5, total: 6 });
    expect(summary).toStrictEqual(await computeSummary(goal));
  });

  it("catches up at the learner's next Start with a change no write recounted", async () => {
    const { goal, user } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });
    await expect(answerDontKnow(goal.id)).resolves.toMatchObject({ status: "ready" });
    await nameSubjectsShortWithoutRefresh(goal.examBlueprintId ?? "");

    await expect(startNextDay({ id: goal.id, userId: user.id })).resolves.toMatchObject({
      status: "opened",
    });

    const summary = await readSummary(goal.id);
    expectShortNames(summary);
    expect(summary).toStrictEqual(await computeSummary(goal));
  });

  it("catches up when the learner opens again a day saved before a change no write recounted", async () => {
    const { goal, user } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });
    await expect(answerDontKnow(goal.id)).resolves.toMatchObject({ status: "ready" });

    await expect(startNextDay({ id: goal.id, userId: user.id })).resolves.toMatchObject({
      created: true,
      status: "opened",
    });

    await nameSubjectsShortWithoutRefresh(goal.examBlueprintId ?? "");

    await expect(openToday(goal.id)).resolves.toMatchObject({ created: false, status: "opened" });

    const summary = await readSummary(goal.id);
    expectShortNames(summary);
    expect(summary).toStrictEqual(await computeSummary(goal));
  });

  it("keeps a numeric answer settled when the focused part changes", async () => {
    const { focusPart, goal } = await focusedPartGoal();
    await expect(readSummary(goal.id)).resolves.toMatchObject({ complete: true });

    await expect(focusPart(1, 7)).resolves.toMatchObject({ status: "applied" });

    const summary = await readSummary(goal.id);
    expect(summary).toMatchObject({ complete: true, offerQuestions: null });
    expect(summary).toStrictEqual(await computeSummary(goal));
  });

  it("counts the questions that keep fitting once research finds the options a question has", async () => {
    const { goal } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });
    const examBlueprintId = goal.examBlueprintId ?? "";
    await expect(readSummary(goal.id)).resolves.toMatchObject({ offerQuestions: 15 });
    await expect(findChoiceOptionsLookup({ examBlueprintId })).resolves.not.toBeNull();

    await recordChoiceOptions({
      board: null,
      edition: null,
      examBlueprintId,
      options: 5,
      source: { title: "Previous paper", url: "https://example.com/previous-paper" },
    });

    await refreshFollowerSummaries(examBlueprintId);

    const summary = await readSummary(goal.id);
    expect(summary).toMatchObject({ offerQuestions: null });
    expect(summary).toStrictEqual(await computeSummary(goal));
  });

  it("keeps the summary when a notice lists the same question formats in another order", async () => {
    const { goal } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });

    const identity = {
      board: null,
      country: "BR",
      language: "en",
      name: `Concurso ${randomUUID()}`,
      ownerId: null,
      role: null,
    };

    const [blueprint, source] = await Promise.all([
      prisma.examBlueprint.update({
        data: { identityKey: buildExamIdentityKey(identity), name: identity.name },
        where: { id: goal.examBlueprintId ?? "" },
      }),
      sourceFixture(),
    ]);

    const content = readBlueprintContent(blueprint);
    const citation = { passage: "p", sourceId: source.id };

    const formats = [4, 5].map((options) => ({
      citation,
      description: "Choice",
      kind: "multipleChoice" as const,
      options,
    }));

    const saveFormats = async (listed: typeof formats) => {
      await saveExamBlueprint({
        content: {
          ...content,
          edition: { ...content.edition, sourceHash: source.contentHash },
          structure: { ...content.structure, formats: listed },
        },
        identity,
        provenance: {
          generatedAt: new Date(),
          model: "test/fixture",
          promptVersion: "test",
          runId: randomUUID(),
        },
        sourceId: source.id,
      });

      await refreshFollowerSummaries(blueprint.id);
      return readSummary(goal.id);
    };

    const summary = await saveFormats(formats);
    await expect(saveFormats(formats.toReversed())).resolves.toStrictEqual(summary);
  });

  it("keeps the summary when the learner names the subjects they know in another order", async () => {
    const { goal } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });

    const answerKnown = (knownSubjects: string[]) =>
      answerOnboardingQuestion({
        goalId: goal.id,
        input: { knownSubjects, level: "basic", question: "level" },
      });

    await expect(answerKnown(["Direito", "Português"])).resolves.toMatchObject({ status: "saved" });
    const summary = await readSummary(goal.id);

    await expect(answerKnown(["Português", "Direito"])).resolves.toMatchObject({ status: "saved" });
    await expect(readSummary(goal.id)).resolves.toStrictEqual(summary);
  });
});
