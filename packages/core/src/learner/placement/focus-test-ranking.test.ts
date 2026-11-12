import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { describe, expect, it } from "vitest";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { PLAN_SHOWN, examTestGoalFixture } from "../_test-utils/exam-test-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { getGoalPlacement } from "./get-goal-placement";

const CASES = [
  {
    answer: { dontKnow: true },
    asked: "Target",
    expected: "Target",
    name: "a missed subject",
    subjectState: "answered",
    target: "Target",
    ticked: false,
  },
  {
    answer: { dontKnow: true },
    asked: "Light",
    expected: "Target",
    name: "an unasked subject",
    subjectState: "notAsked",
    target: "Target",
    ticked: false,
  },
  {
    answer: { selectedIndex: 0 },
    asked: "Target",
    expected: "Other",
    name: "a subject answered right",
    subjectState: "answered",
    target: "Target",
    ticked: false,
  },
  {
    answer: { dontKnow: true },
    asked: "Light",
    expected: "Essay",
    name: "a written subject",
    subjectState: "notChecked",
    target: "Essay",
    ticked: false,
  },
  {
    answer: { dontKnow: true },
    asked: "Light",
    expected: "Target",
    name: "a subject ticked as known but never asked",
    subjectState: "notAsked",
    target: "Target",
    ticked: true,
  },
] as const;

describe("the Focus test ranking acceptance examples", () => {
  it.each([
    { expected: "Target", source: "focusTest" },
    { expected: "Target", source: "mock" },
    { expected: "Other", source: "learner" },
  ])("uses the incumbent margin only for a $source focus", async ({ expected, source }) => {
    const { goal, items, plan, subjectOf, user } = await examTestGoalFixture({
      coveredShare: 0.5,
      goal: { ...PLAN_SHOWN, timezone: "UTC" },
      subjects: [
        { name: "Target", questions: 100 },
        { name: "Other", questions: 109 },
        { name: "Light", questions: 1 },
      ],
    });

    const areas = ["Target"];

    await prisma.plan.update({
      data: { settings: { ...parsePlanSettings(plan.settings), focusAreas: areas } },
      where: { id: plan.id },
    });

    await planChangeFixture({
      payload: { operations: [{ areas, kind: "focusAreas" }], source },
      planId: plan.id,
      status: "applied",
    });

    const answered = items.find((item) => subjectOf(item.skillId) === "Light")!;

    await attemptFixture({
      isPlacement: true,
      itemId: answered.id,
      skillId: answered.skillId,
      userId: user.id,
    });

    const result = await getGoalPlacement({ goalId: goal.id });

    expect(
      result.status === "ready" && result.placement.focusTest?.checkpoint?.focus?.rows,
    ).toMatchObject([{ subject: { name: expected } }]);
  });

  it.each(CASES)("ranks $name from real answers and exam importance", async (sample) => {
    const { blueprint, goal, items, subjectOf } = await examTestGoalFixture({
      goal: sample.ticked
        ? {
            details: {
              answered: ["target", "level", "targetDate", "buddy"],
              knownSubjects: [sample.target],
              level: "advanced",
            },
          }
        : {},
      subjects: [
        { name: sample.target, questions: 10 },
        { name: "Other", questions: 9 },
        { name: "Light", questions: 1 },
      ],
    });

    if (sample.target === "Essay") {
      const { structure } = readBlueprintContent(blueprint);

      await prisma.examBlueprint.update({
        data: {
          structure: {
            ...structure,
            subjects: (structure?.subjects ?? []).map((subject, index) => ({
              ...subject,
              weight: [0.6, 0.35, 0.05][index],
            })),
          },
        },
        where: { id: blueprint.id },
      });
    }

    const result = await answerPlacementQuestion({
      goalId: goal.id,
      input: {
        answer: sample.answer,
        durationMs: 10_000,
        itemId: items.find((item) => subjectOf(item.skillId) === sample.asked)?.id ?? "",
      },
    });

    expect(result.status).toBe("ready");

    const focus = result.status === "ready" ? result.placement.focusTest : null;

    expect(focus?.checkpoint?.focus?.rows).toMatchObject([{ subject: { name: sample.expected } }]);

    expect(focus?.subjects[0]).toMatchObject({
      asked: sample.asked === sample.target ? 1 : 0,
      state: sample.subjectState,
    });

    expect(focus?.subjects[0]?.part).toBe(sample.target === "Essay" ? "written" : null);
  });
});
