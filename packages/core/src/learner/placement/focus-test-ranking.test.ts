import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { examTestGoalFixture } from "../_test-utils/exam-test-goal";
import { answerPlacementQuestion } from "./answer-placement-question";

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
