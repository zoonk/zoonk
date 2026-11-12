import { prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import {
  holdLearnerLock,
  holdPlanLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import {
  linkGoalToExamBlueprint,
  unlinkGoalFromSharedExam,
} from "../../library/exams/exam-learners";
import {
  findSubjectQuestionsLookup,
  recordSubjectQuestions,
} from "../../library/exams/record-subject-questions";
import { changeGoalPlan } from "../../plans/change-goal-plan";
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

    const { graph } = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
    const skillId = (graph as { skills: { skillId: string }[] }).skills[0]?.skillId ?? "";

    await learnerSkillFixture({
      due: new Date(Date.now() - 60 * 60 * 1000),
      lastReviewedAt: new Date(Date.now() - MS_PER_DAY),
      reps: 2,
      skillId,
      state: "learning",
      userId: user.id,
    });

    await expect(
      openStudyDay({
        goalId: goal.id,
        shownDate: new Date().toISOString().slice(0, 10),
        timeZone: "UTC",
      }),
    ).resolves.toMatchObject({ status: "opened" });

    const summary = await readSummary(goal.id);
    expect(summary).toMatchObject({ quick: 5, total: 5, unasked: 5 });
    expect(summary).toStrictEqual(await computeSummary(goal));
  });

  it("follows the notice research links or unlinks, with the option it names", async () => {
    const { goal } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });

    const blueprintId = await laterOptionNotice({
      details: { targetPosition: "Português" },
      goal,
      mock: {
        adaptive: false,
        citations: [],
        order: null,
        scoring: { description: "", method: "raw" },
        sections: [{ day: 1, kind: "written", minutes: 30, name: "Português", questions: 1 }],
        timeLimitMinutes: 30,
        totalQuestions: 1,
      },
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
});
