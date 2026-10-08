import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  choiceItemContent,
  itemFixture,
  skillFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

const DONT_KNOW = { dontKnow: true } as const;
const RIGHT = { selectedIndex: 0 };

async function setup(phases = [3, 2]) {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ phases, userId: user.id });
  mockSession(user.id);

  return { ...fixture, user };
}

/** The item bank's easy, medium and hard questions. */
const DIFFICULTIES = [-1, 0, 1];

type PlanSkill = {
  area: string | null;
  /** The Library band the skill graph put the skill in. */
  band?: "beginner" | "intermediate" | "overview";
  builds: number | null;
  /** The skill graph's phase; its first phase holds each subject's foundations. */
  phase?: number;
};

/**
 * A goal whose skill graph lists `planSkills` in plan order, one phase, each skill building on the
 * one `builds` points at, with one question per difficulty for each skill in `withItems`. Only the
 * skills in `inPlan` have plan items: the others are the graph's skills the plan leaves out at the
 * learner's time.
 */
async function graphGoalFixture({
  details = {},
  inPlan,
  planSkills,
  withItems = planSkills.map((_, index) => index),
}: {
  /** What onboarding stored on the goal, such as the learner's own level. */
  details?: Record<string, string | string[]>;
  inPlan?: number[];
  planSkills: PlanSkill[];
  withItems?: number[];
}) {
  const user = await userFixture();
  const goal = await goalFixture({ details, userId: user.id });

  const skills = await Promise.all(
    planSkills.map((planSkill, index) =>
      skillFixture({ level: planSkill.band ?? null, name: `Graph skill ${index + 1}` }),
    ),
  );

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [
        { milestone: null, name: "Phase 1" },
        { milestone: null, name: "Phase 2" },
      ],
      skills: skills.map((skill, index) => ({
        area: planSkills[index]?.area ?? null,
        lessons: 1,
        name: skill.name,
        phase: planSkills[index]?.phase ?? 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  const skillAt = (index: number) => skills[index]?.id ?? "";

  const [items] = await Promise.all([
    Promise.all(
      withItems.flatMap((index) =>
        DIFFICULTIES.map((difficulty) =>
          itemFixture({ content: choiceItemContent(), difficulty, skillId: skillAt(index) }),
        ),
      ),
    ),
    Promise.all(
      planSkills.flatMap(({ builds }, index) =>
        builds === null
          ? []
          : [
              skillPrerequisiteFixture({
                prerequisiteId: skillAt(builds),
                skillId: skillAt(index),
              }),
            ],
      ),
    ),
    Promise.all(
      (inPlan ?? planSkills.map((_, index) => index)).map((index, position) =>
        planItemFixture({ phase: 0, planId: plan.id, position, skillId: skillAt(index) }),
      ),
    ),
  ]);

  mockSession(user.id);
  return { goal, items, skills, user };
}

/** Three skills in a row, each building on the one before, in one area. */
const CHAIN: PlanSkill[] = [
  { area: null, builds: null },
  { area: null, builds: 0 },
  { area: null, builds: 1 },
];

/** An exam's math and history, each a chain of three, interleaved like the plan puts them. */
const TWO_AREAS: PlanSkill[] = [
  { area: "Math", builds: null },
  { area: "History", builds: null },
  { area: "Math", builds: 0 },
  { area: "History", builds: 1 },
  { area: "Math", builds: 2 },
  { area: "History", builds: 3 },
];

/**
 * An exam's law and English, each a few skills in the Library bands the skill graph gave them, with
 * no prerequisites between them, like a notice's subjects.
 */
const BANDED_EXAM: PlanSkill[] = [
  { area: "Law", band: "overview", builds: null },
  { area: "Law", band: "beginner", builds: null },
  { area: "Law", band: "intermediate", builds: null },
  { area: "English", band: "beginner", builds: null },
  { area: "English", band: "intermediate", builds: null },
];

/**
 * An ENEM-like exam whose plan, at the time it has before the learner picks theirs, holds only its
 * essay (`ESSAY_ONLY_PLAN`): its other subjects don't fit yet, though the skill graph has them all.
 */
const ESSAY_FIRST_EXAM: PlanSkill[] = [
  { area: "Redação", builds: null },
  { area: "Redação", builds: 0 },
  { area: "Natureza", builds: null },
  { area: "Natureza", builds: 2 },
  { area: "Humanas", builds: null },
  { area: "Humanas", builds: 4 },
];

const ESSAY_ONLY_PLAN = [0, 1];

function sortIds(ids: readonly (string | undefined)[]) {
  return ids.toSorted((a, b) => String(a).localeCompare(String(b)));
}

async function readNext(goalId: string) {
  const result = await getGoalPlacement({ goalId });
  return result.status === "ready" ? result.placement : null;
}

async function answerNext({
  answer,
  goalId,
}: {
  answer: typeof RIGHT | typeof DONT_KNOW;
  goalId: string;
}) {
  const placement = await readNext(goalId);

  const result = await answerPlacementQuestion({
    goalId,
    input: { answer, durationMs: 5000, itemId: placement?.next?.itemId ?? "" },
  });

  return result.status === "ready" ? result.placement : null;
}

function difficultyOf({
  itemId,
  items,
}: {
  itemId?: string;
  items: { difficulty: number | null; id: string }[];
}) {
  return items.find((item) => item.id === itemId)?.difficulty;
}

describe(getGoalPlacement, () => {
  it("requires a signed-in learner", async () => {
    mockSession(null);

    await expect(getGoalPlacement({ goalId: crypto.randomUUID() })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("hides another learner's goal", async () => {
    const { goal } = await setup();
    const other = await userFixture();
    mockSession(other.id);

    await expect(getGoalPlacement({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("asks the first question from the middle of the plan, without its answers", async () => {
    const { goal, skills } = await setup();

    const result = await getGoalPlacement({ goalId: goal.id });

    expect(result.status).toBe("ready");

    expect(result.status === "ready" && result.placement).toMatchObject({
      answered: 0,
      complete: false,
      needsItems: [],
    });

    expect(result.status === "ready" && result.placement.next?.skillId).toBe(skills[2]?.id);
    expect(result.status === "ready" && result.placement.status).toBe("asking");
  });

  it("counts as started once this goal's placement has an answer, not from earlier answers", async () => {
    const { goal, items, skills, user } = await graphGoalFixture({ planSkills: CHAIN });

    // Another goal's placement asked about the same skill before this goal existed.
    await attemptFixture({
      answeredAt: new Date(goal.createdAt.getTime() - 60_000),
      itemId: items[0]?.id,
      skillId: skills[0]?.id,
      userId: user.id,
    });

    const before = await readNext(goal.id);
    const after = await answerNext({ answer: RIGHT, goalId: goal.id });

    expect(before).toMatchObject({ answered: 1, started: false });
    expect(after).toMatchObject({ answered: 2, started: true });
  });

  it("sends the question, its options and its picture, chart or timeline only: nothing that tells the answer", async () => {
    const { goal } = await setup();
    const result = await getGoalPlacement({ goalId: goal.id });
    const next = result.status === "ready" ? result.placement.next : null;

    expect(Object.keys(next ?? {}).toSorted()).toStrictEqual([
      "context",
      "format",
      "image",
      "itemId",
      "options",
      "question",
      "skillId",
      "visual",
    ]);

    expect(next?.options).toStrictEqual(["Right answer", "Wrong answer"]);

    // The item's reasons and misconception label stay on the server until it's answered.
    const sent = JSON.stringify(result);

    expect(sent).not.toMatch(/isCorrect|misconception|reason|follows the rule|backwards/u);
  });

  it("says the plan isn't ready instead of complete while its skill map is being drawn", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    await planFixture({ goalId: goal.id });
    mockSession(user.id);

    const result = await getGoalPlacement({ goalId: goal.id });

    expect(result.status === "ready" && result.placement).toMatchObject({
      areas: [],
      complete: false,
      next: null,
      phases: [],
      status: "preparing",
    });

    const finished = await finishGoalPlacement({ goalId: goal.id, input: {} });
    expect(finished.status === "ready" && finished.completion.complete).toBe(false);
  });

  it("waits for the questions written right after the plan", async () => {
    const { goal, skills } = await graphGoalFixture({ planSkills: CHAIN, withItems: [] });

    await expect(readNext(goal.id)).resolves.toMatchObject({
      complete: false,
      needsItems: skills.map((skill) => skill.id),
      next: null,
      status: "waitingForQuestions",
    });
  });

  it("asks a question that's ready while the one it would ask first is written, then goes back to its walk", async () => {
    // Placement starts in the middle; only the first skill's questions are in the bank so far.
    const { goal, skills } = await graphGoalFixture({ planSkills: CHAIN, withItems: [0] });

    await expect(readNext(goal.id)).resolves.toMatchObject({
      next: { skillId: skills[0]?.id },
      status: "asking",
    });

    await Promise.all(
      DIFFICULTIES.map((difficulty) =>
        itemFixture({ content: choiceItemContent(), difficulty, skillId: skills[1]?.id ?? "" }),
      ),
    );

    await expect(readNext(goal.id)).resolves.toMatchObject({
      next: { skillId: skills[1]?.id },
      status: "asking",
    });
  });

  it("never opens with a written-answer question while its quick one is still being written", async () => {
    // Only the first skill has a question in the bank so far, and it's one answered in words.
    const { goal, skills } = await graphGoalFixture({ planSkills: CHAIN, withItems: [] });

    await itemFixture({
      content: {
        acceptedAnswers: [],
        context: null,
        keyPoints: ["Names the rule"],
        question: "Which rule applies here, and why?",
        sampleAnswer: "The rule, because the case fits it.",
      },
      format: "typed",
      skillId: skills[0]?.id ?? "",
    });

    await expect(readNext(goal.id)).resolves.toMatchObject({
      next: null,
      status: "waitingForQuestions",
    });
  });

  it("waits for the skill its walk goes to next instead of asking the last one again", async () => {
    // Only the middle skill's questions are written so far: a right answer there leads on to the
    // last skill, whose questions are still being written.
    const { goal, skills } = await graphGoalFixture({ planSkills: CHAIN, withItems: [1] });

    await expect(readNext(goal.id)).resolves.toMatchObject({ next: { skillId: skills[1]?.id } });

    await expect(answerNext({ answer: RIGHT, goalId: goal.id })).resolves.toMatchObject({
      next: null,
      status: "waitingForQuestions",
    });
  });

  it("asks what's written once the question it would ask first couldn't be", async () => {
    const { goal, skills } = await graphGoalFixture({ planSkills: CHAIN, withItems: [0] });

    await prisma.plan.update({
      data: { placementPreparedAt: new Date() },
      where: { goalId: goal.id },
    });

    await expect(readNext(goal.id)).resolves.toMatchObject({
      next: { skillId: skills[0]?.id },
      status: "asking",
    });
  });

  it("never asks another exam's questions on a shared skill, only general ones and its own exam's", async () => {
    const { goal, skills } = await graphGoalFixture({
      planSkills: CHAIN.slice(0, 1),
      withItems: [],
    });

    const [ownExam, otherExam] = await Promise.all([
      examBlueprintFixture(),
      examBlueprintFixture(),
    ]);

    const skillId = skills[0]?.id ?? "";

    await prisma.goal.update({ data: { examBlueprintId: ownExam.id }, where: { id: goal.id } });

    const [, own] = await Promise.all([
      itemFixture({
        content: choiceItemContent("On the first day of the other exam?"),
        examBlueprintId: otherExam.id,
        skillId,
      }),
      itemFixture({
        content: choiceItemContent("In this exam?"),
        examBlueprintId: ownExam.id,
        skillId,
      }),
    ]);

    await expect(readNext(goal.id)).resolves.toMatchObject({ next: { itemId: own.id } });

    await prisma.item.delete({ where: { id: own.id } });
    await expect(readNext(goal.id)).resolves.toMatchObject({ next: null });
  });

  it("asks an exam that judges assertions its true/false questions before shared multiple choice", async () => {
    const { goal, skills } = await graphGoalFixture({
      planSkills: CHAIN.slice(0, 1),
      withItems: [],
    });

    const skillId = skills[0]?.id ?? "";

    const [trueFalseExam, choice, trueFalse] = await Promise.all([
      examBlueprintFixture({
        structure: {
          formats: [
            {
              citation: { passage: "Certo ou Errado.", sourceId: "notice" },
              description: "Itens julgados Certo ou Errado.",
              kind: "trueFalse",
              options: null,
            },
          ],
          mock: null,
          rules: [],
          subjects: [],
        },
      }),
      itemFixture({ content: choiceItemContent(), skillId }),
      itemFixture({
        content: {
          context: null,
          isTrue: false,
          misconception: "Swaps the rule's exception",
          reason: "The exception is the other way around.",
          statement: "The rule has no exception.",
        },
        format: "trueFalse",
        skillId,
      }),
    ]);

    // A goal without an exam asks multiple choice first.
    await expect(readNext(goal.id)).resolves.toMatchObject({ next: { itemId: choice.id } });

    // Without questions of its own once writing ended, the exam falls back to general ones.
    await Promise.all([
      prisma.goal.update({ data: { examBlueprintId: trueFalseExam.id }, where: { id: goal.id } }),
      prisma.plan.update({ data: { placementPreparedAt: new Date() }, where: { goalId: goal.id } }),
    ]);

    await expect(readNext(goal.id)).resolves.toMatchObject({
      next: { format: "trueFalse", itemId: trueFalse.id },
    });
  });

  it("says the plan couldn't be built, instead of preparing forever, when its run gave up", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    await planFixture({ buildFailedAt: new Date(), goalId: goal.id });
    mockSession(user.id);

    await expect(readNext(goal.id)).resolves.toMatchObject({ next: null, status: "failed" });
  });

  it("goes on without placement once the run says none of its questions could be written", async () => {
    const { goal } = await graphGoalFixture({ planSkills: CHAIN, withItems: [] });

    await prisma.plan.update({
      data: { placementPreparedAt: new Date() },
      where: { goalId: goal.id },
    });

    await expect(readNext(goal.id)).resolves.toMatchObject({
      complete: false,
      next: null,
      status: "unavailable",
    });
  });

  it("stops waiting once the questions' writing window has passed without them", async () => {
    const { goal } = await graphGoalFixture({ planSkills: CHAIN, withItems: [] });

    await prisma.plan.update({
      data: { generatedAt: new Date(Date.now() - 11 * 60 * 1000) },
      where: { goalId: goal.id },
    });

    await expect(readNext(goal.id)).resolves.toMatchObject({ next: null, status: "unavailable" });
  });

  it("counts the writing window from the skill graph, not from when the goal was created", async () => {
    const { goal } = await graphGoalFixture({ planSkills: CHAIN, withItems: [] });

    // The plan row is created with the goal; its graph came minutes later, after the answers.
    await prisma.plan.update({
      data: { createdAt: new Date(Date.now() - 11 * 60 * 1000), generatedAt: new Date() },
      where: { goalId: goal.id },
    });

    await expect(readNext(goal.id)).resolves.toMatchObject({ status: "waitingForQuestions" });
  });

  it("is done, not waiting, when what's left has no question coming", async () => {
    // Seven skills in a row: questions are written for the first, the middle and the last.
    const planSkills = Array.from({ length: 7 }, (_, index) => ({
      area: null,
      builds: index === 0 ? null : index - 1,
    }));

    const { goal, items, skills } = await graphGoalFixture({ planSkills, withItems: [0, 3, 6] });
    const [firstEasy, firstMedium, , middleEasy] = items;

    // Knows the first skill, not the middle one: only skills 2 and 3, without questions, are left.
    await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: RIGHT, durationMs: 5000, itemId: firstEasy?.id ?? "" },
    });

    await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: RIGHT, durationMs: 5000, itemId: firstMedium?.id ?? "" },
    });

    await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: DONT_KNOW, durationMs: 5000, itemId: middleEasy?.id ?? "" },
    });

    const placement = await readNext(goal.id);

    expect(placement?.needsItems.length).toBeGreaterThan(0);
    expect(placement?.needsItems).not.toContain(skills[3]?.id);
    expect(placement).toMatchObject({ complete: false, next: null, status: "done" });
  });
});

describe("adaptive placement", () => {
  it("asks a harder question after a right answer and an easier one after a wrong one", async () => {
    const right = await graphGoalFixture({ planSkills: CHAIN });
    const first = await readNext(right.goal.id);
    expect(difficultyOf({ itemId: first?.next?.itemId, items: right.items })).toBe(0);

    const afterRight = await answerNext({ answer: RIGHT, goalId: right.goal.id });

    expect(afterRight?.next?.skillId).toBe(right.skills[2]?.id);
    expect(difficultyOf({ itemId: afterRight?.next?.itemId, items: right.items })).toBe(1);

    const wrong = await graphGoalFixture({ planSkills: CHAIN });
    const afterWrong = await answerNext({ answer: DONT_KNOW, goalId: wrong.goal.id });

    expect(afterWrong?.next?.skillId).toBe(wrong.skills[0]?.id);
    expect(difficultyOf({ itemId: afterWrong?.next?.itemId, items: wrong.items })).toBe(-1);
  });

  it("samples every area of an exam before going deeper in one, and places each", async () => {
    const { goal, skills } = await graphGoalFixture({ planSkills: TWO_AREAS });

    const areaOf = (skillId?: string) =>
      TWO_AREAS[skills.findIndex((skill) => skill.id === skillId)]?.area;

    const first = await readNext(goal.id);
    const second = await answerNext({ answer: RIGHT, goalId: goal.id });

    expect([areaOf(first?.next?.skillId), areaOf(second?.next?.skillId)]).toStrictEqual([
      "Math",
      "History",
    ]);

    expect(second?.areas.map((area) => area.area)).toStrictEqual(["Math", "History"]);

    // "I don't know yet" on everything else settles where each area starts.
    const answers = Array.from({ length: 6 });

    const final = await answers.reduce<Promise<Awaited<ReturnType<typeof readNext>>>>(
      async (previous) => {
        const placement = await previous;
        return placement?.next ? answerNext({ answer: DONT_KNOW, goalId: goal.id }) : placement;
      },
      Promise.resolve(second),
    );

    expect(final).toMatchObject({
      areas: [
        { area: "Math", confident: true },
        { area: "History", confident: true, startSkillId: skills[1]?.id },
      ],
      complete: true,
      status: "done",
    });
  });

  it("asks every subject of the exam, the ones the plan's time leaves out included", async () => {
    const { goal, skills } = await graphGoalFixture({
      inPlan: ESSAY_ONLY_PLAN,
      planSkills: ESSAY_FIRST_EXAM,
    });

    const areaOf = (skillId?: string) =>
      ESSAY_FIRST_EXAM[skills.findIndex((skill) => skill.id === skillId)]?.area;

    const first = await readNext(goal.id);
    const second = await answerNext({ answer: RIGHT, goalId: goal.id });
    const third = await answerNext({ answer: RIGHT, goalId: goal.id });

    expect(
      [first, second, third]
        .map((placement) => areaOf(placement?.next?.skillId) ?? "")
        .toSorted((a, b) => a.localeCompare(b)),
    ).toStrictEqual(["Humanas", "Natureza", "Redação"]);

    expect(third).toMatchObject({ complete: false, status: "asking" });
    expect(third?.areas.map((area) => area.area)).toStrictEqual(["Redação", "Natureza", "Humanas"]);
  });

  it("waits for the subjects whose questions are still being written instead of ending after the first", async () => {
    // Questions are written in batches: only the essay's are in the bank so far.
    const { goal, skills } = await graphGoalFixture({
      inPlan: ESSAY_ONLY_PLAN,
      planSkills: ESSAY_FIRST_EXAM,
      withItems: ESSAY_ONLY_PLAN,
    });

    await expect(readNext(goal.id)).resolves.toMatchObject({ next: { skillId: skills[0]?.id } });

    // "I don't know yet" on the essay's first skill settles where the essay starts.
    await expect(answerNext({ answer: DONT_KNOW, goalId: goal.id })).resolves.toMatchObject({
      complete: false,
      next: null,
      status: "waitingForQuestions",
    });

    await Promise.all(
      [2, 3].flatMap((index) =>
        DIFFICULTIES.map((difficulty) =>
          itemFixture({
            content: choiceItemContent(),
            difficulty,
            skillId: skills[index]?.id ?? "",
          }),
        ),
      ),
    );

    const next = await readNext(goal.id);

    expect(next?.status).toBe("asking");
    expect([skills[2]?.id, skills[3]?.id]).toContain(next?.next?.skillId);
  });

  it("starts where the learner's own level points", async () => {
    const { goal, skills } = await setup();

    const result = await getGoalPlacement({ goalId: goal.id, level: "none" });

    expect(result.status === "ready" && result.placement.next?.skillId).toBe(skills[0]?.id);
  });

  it("says which undecided skills need questions made", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [2],
      userId: user.id,
    });

    mockSession(user.id);

    const result = await getGoalPlacement({ goalId: goal.id });

    expect(result.status === "ready" && result.placement.next).toBeNull();

    expect(result.status === "ready" && result.placement.needsItems).toStrictEqual(
      skills.map((skill) => skill.id),
    );
  });
});

describe(answerPlacementQuestion, () => {
  it("settles every phase after 'I don't know yet' on the first skill", async () => {
    const { goal, items, skills, user } = await setup();
    const firstItem = items.find((item) => item.skillId === skills[0]?.id);

    const result = await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: DONT_KNOW, durationMs: 4000, itemId: firstItem?.id ?? "" },
    });

    expect(result.status === "ready" && result.placement).toMatchObject({
      answered: 1,
      complete: true,
      next: null,
      phases: [
        { confident: true, phase: 0, startSkillId: skills[0]?.id },
        { confident: true, phase: 1, startSkillId: skills[3]?.id },
      ],
      status: "done",
    });

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);
    await expect(prisma.mistake.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.learnerSkill.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("moves to harder skills after right answers and never repeats a question", async () => {
    const { goal, items, skills } = await setup();
    const middle = items.filter((item) => item.skillId === skills[2]?.id);

    const first = await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: RIGHT, durationMs: 9000, itemId: middle[0]?.id ?? "" },
    });

    const second = await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: RIGHT, durationMs: 9000, itemId: middle[1]?.id ?? "" },
    });

    expect(first.status === "ready" && first.isCorrect).toBe(true);

    expect(second.status === "ready" && second.placement.knownSkillIds).toStrictEqual(
      skills.slice(0, 3).map((skill) => skill.id),
    );

    expect(second.status === "ready" && second.placement.next?.skillId).toBe(skills[3]?.id);
  });

  it("still takes the open question after a re-plan moved its skill out of the plan", async () => {
    const { goal, items, planItems, skills, user } = await setup();
    const asked = items.find((item) => item.skillId === skills[2]?.id);

    // The re-plan swapped the lesson this question was asked on for another one.
    await prisma.planItem.delete({ where: { id: planItems[2]?.id ?? "" } });

    const result = await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: RIGHT, durationMs: 5000, itemId: asked?.id ?? "" },
    });

    expect(result.status === "ready" && result.isCorrect).toBe(true);
    expect(result.status === "ready" && result.placement.next?.skillId).not.toBe(skills[2]?.id);

    await expect(
      prisma.attempt.count({ where: { itemId: asked?.id, userId: user.id } }),
    ).resolves.toBe(1);
  });

  it("rejects another learner's private question and another exam's", async () => {
    const { goal } = await setup();
    const owner = await userFixture();
    const blueprint = await examBlueprintFixture();

    const [privateSkill, sharedSkill] = await Promise.all([
      skillFixture({ ownerId: owner.id, visibility: "private" }),
      skillFixture(),
    ]);

    const [privateItem, otherExamItem] = await Promise.all([
      itemFixture({ content: choiceItemContent(), skillId: privateSkill.id }),
      itemFixture({
        content: choiceItemContent(),
        examBlueprintId: blueprint.id,
        skillId: sharedSkill.id,
      }),
    ]);

    const answers = await Promise.all(
      [privateItem, otherExamItem].map((item) =>
        answerPlacementQuestion({
          goalId: goal.id,
          input: { answer: RIGHT, durationMs: 5000, itemId: item.id },
        }),
      ),
    );

    expect(answers).toStrictEqual([{ status: "invalidItem" }, { status: "invalidItem" }]);
  });
});

describe(finishGoalPlacement, () => {
  it("records known skills and tests out what the plan no longer needs", async () => {
    const { goal, items, planItems, skills, user } = await setup();
    const middle = items.filter((item) => item.skillId === skills[2]?.id);

    await Promise.all(
      middle.map((item) =>
        answerPlacementQuestion({
          goalId: goal.id,
          input: { answer: RIGHT, durationMs: 9000, itemId: item.id },
        }),
      ),
    );

    const result = await finishGoalPlacement({ goalId: goal.id, input: {} });
    const knownIds = skills.slice(0, 3).map((skill) => skill.id);

    expect(result.status === "ready" && result.completion).toMatchObject({
      knownSkillIds: knownIds,
      testedOutPlanItemIds: planItems.slice(0, 3).map((item) => item.id),
    });

    const learnerSkills = await prisma.learnerSkill.findMany({ where: { userId: user.id } });
    expect(learnerSkills.map((row) => row.skillId).toSorted()).toStrictEqual(knownIds.toSorted());
    expect(learnerSkills.every((row) => row.reps > 0 && row.due !== null)).toBe(true);

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: planItems[3]?.id } }),
    ).resolves.toMatchObject({ status: "todo" });
  });

  it("names the lesson the plan opens with once placement tested some out, so it's written now", async () => {
    const { goal, items, planItems, skills } = await setup();
    const lessons = await Promise.all(planItems.map(() => libraryLessonFixture()));

    await Promise.all(
      planItems.map((item, index) =>
        prisma.planItem.update({ data: { lessonId: lessons[index]?.id }, where: { id: item.id } }),
      ),
    );

    const known = items.filter((item) => item.skillId === skills[2]?.id);

    await Promise.all(
      known.map((item) =>
        answerPlacementQuestion({
          goalId: goal.id,
          input: { answer: RIGHT, durationMs: 9000, itemId: item.id },
        }),
      ),
    );

    const result = await finishGoalPlacement({ goalId: goal.id, input: {} });

    // The first three skills are known: the plan now opens with the fourth one's lesson.
    expect(result).toMatchObject({ firstLessonId: lessons[3]?.id, status: "ready" });
  });

  it("starts a learner who studied the subject before past its basics, in every subject", async () => {
    const { goal, skills } = await graphGoalFixture({
      details: { level: "intermediate" },
      planSkills: BANDED_EXAM,
    });

    const result = await finishGoalPlacement({ goalId: goal.id, input: {} });

    // The overview and beginner skills of both subjects; the intermediate ones are left to study.
    expect(result.status === "ready" && sortIds(result.completion.knownSkillIds)).toStrictEqual(
      sortIds([skills[0]?.id, skills[1]?.id, skills[3]?.id]),
    );

    const items = await prisma.planItem.findMany({
      where: { plan: { goalId: goal.id }, skillId: { not: null } },
    });

    const statusOf = (index: number) =>
      items.find((item) => item.skillId === skills[index]?.id)?.status;

    expect([0, 1, 2, 3, 4].map((index) => statusOf(index))).toStrictEqual([
      "testedOut",
      "testedOut",
      "todo",
      "testedOut",
      "todo",
    ]);
  });

  it("never skips a whole subject from a stated level alone: it asks first", async () => {
    // "Understand personal finance": an overview the learner says they know a little of. The last
    // skill builds on the others, and placement had no question written for it.
    const { goal, skills } = await graphGoalFixture({
      details: { level: "basic" },
      planSkills: [
        { area: "Finance", band: "overview", builds: null },
        { area: "Finance", band: "overview", builds: 0 },
        { area: "Finance", band: "overview", builds: 1 },
        { area: "Finance", band: "beginner", builds: 2 },
      ],
      withItems: [0, 1, 2],
    });

    await prisma.plan.update({
      data: { placementPreparedAt: new Date() },
      where: { goalId: goal.id },
    });

    const placement = await readNext(goal.id);

    expect(placement?.status).toBe("asking");
    expect([skills[0]?.id, skills[1]?.id, skills[2]?.id]).toContain(placement?.next?.skillId);

    // Ended before any answer: nothing is assumed known, so nothing is skipped.
    const result = await finishGoalPlacement({ goalId: goal.id, input: {} });

    expect(result).toMatchObject({
      completion: { knownSkillIds: [], testedOutPlanItemIds: [] },
      status: "ready",
    });
  });

  it("starts the subjects the learner said they know well past their basics, only those", async () => {
    const { goal, skills } = await graphGoalFixture({
      details: { knownSubjects: ["Law"] },
      planSkills: BANDED_EXAM,
    });

    const result = await finishGoalPlacement({ goalId: goal.id, input: {} });

    expect(result.status === "ready" && sortIds(result.completion.knownSkillIds)).toStrictEqual(
      sortIds([skills[0]?.id, skills[1]?.id]),
    );
  });

  it("starts a subject the learner knows well past its foundations when the exam asks all of it at one band", async () => {
    // Like a public exam's Portuguese: every skill at the exam's band, the foundations in the skill
    // graph's first phase and the rest building on them later.
    const { goal, skills } = await graphGoalFixture({
      details: { knownSubjects: ["Portuguese"] },
      planSkills: [
        { area: "Portuguese", band: "intermediate", builds: null, phase: 0 },
        { area: "Math", band: "intermediate", builds: null, phase: 0 },
        { area: "Portuguese", band: "intermediate", builds: 0, phase: 1 },
        { area: "Math", band: "intermediate", builds: 1, phase: 1 },
      ],
    });

    const result = await finishGoalPlacement({ goalId: goal.id, input: {} });

    expect(result.status === "ready" && result.completion.knownSkillIds).toStrictEqual([
      skills[0]?.id,
    ]);

    const items = await prisma.planItem.findMany({
      select: { skillId: true, status: true },
      where: { plan: { goalId: goal.id }, skillId: { not: null } },
    });

    const statusOf = (index: number) =>
      items.find((item) => item.skillId === skills[index]?.id)?.status;

    expect([0, 1, 2, 3].map((index) => statusOf(index))).toStrictEqual([
      "testedOut",
      "todo",
      "todo",
      "todo",
    ]);
  });

  it("skips the basics of a subject the learner knows well even while the plan's time leaves them out", async () => {
    // Before the learner picks their time, the plan holds only what the default time fits: here
    // none of Portuguese's basics. Once they pick more time, a re-plan must not bring them back.
    const { goal, skills } = await graphGoalFixture({
      details: { knownSubjects: ["Portuguese"] },
      inPlan: [1, 2, 3],
      planSkills: [
        { area: "Portuguese", band: "intermediate", builds: null, phase: 0 },
        { area: "Math", band: "intermediate", builds: null, phase: 0 },
        { area: "Portuguese", band: "intermediate", builds: 0, phase: 1 },
        { area: "Math", band: "intermediate", builds: 1, phase: 1 },
      ],
    });

    const result = await finishGoalPlacement({ goalId: goal.id, input: {} });

    const standIn = await prisma.planItem.findFirst({
      where: { plan: { goalId: goal.id }, skillId: skills[0]?.id },
    });

    expect(standIn).toMatchObject({
      chapterId: null,
      kind: "lesson",
      lessonId: null,
      phase: 0,
      status: "testedOut",
      titleSnapshot: skills[0]?.name,
    });

    expect(result.status === "ready" && result.completion.testedOutPlanItemIds).toStrictEqual([
      standIn?.id,
    ]);

    // Finishing again adds nothing: the skill has its item now.
    await finishGoalPlacement({ goalId: goal.id, input: {} });

    await expect(
      prisma.planItem.count({ where: { plan: { goalId: goal.id }, skillId: skills[0]?.id } }),
    ).resolves.toBe(1);
  });

  it("counts right answers on a subject's harder skill for its basics, not another subject's", async () => {
    const { goal, items, skills } = await graphGoalFixture({ planSkills: BANDED_EXAM });
    const lawIntermediate = items.filter((item) => item.skillId === skills[2]?.id).slice(0, 2);

    // Two quick right answers on the law's intermediate skill.
    await Promise.all(
      lawIntermediate.map((item) =>
        answerPlacementQuestion({
          goalId: goal.id,
          input: { answer: RIGHT, durationMs: 9000, itemId: item.id },
        }),
      ),
    );

    const result = await finishGoalPlacement({ goalId: goal.id, input: {} });

    expect(result.status === "ready" && sortIds(result.completion.knownSkillIds)).toStrictEqual(
      sortIds([skills[0]?.id, skills[1]?.id, skills[2]?.id]),
    );
  });

  it("tests out only the topics its answers checked in a test from the learner's own material", async () => {
    // Pedro's handout: the level he gave and two right answers on organelles skipped all of it.
    const { goal, items, skills, user } = await graphGoalFixture({
      details: { level: "advanced" },
      planSkills: [
        { area: "Biologia", band: "overview", builds: null },
        { area: "Biologia", band: "beginner", builds: null },
        { area: "Biologia", band: "intermediate", builds: 1 },
        { area: "Biologia", band: "intermediate", builds: null },
      ],
    });

    const blueprint = await examBlueprintFixture({ ownerId: user.id });

    await prisma.goal.update({
      data: { examBlueprintId: blueprint.id, kind: "exam" },
      where: { id: goal.id },
    });

    const organelles = items.filter((item) => item.skillId === skills[2]?.id).slice(0, 2);

    await Promise.all(
      organelles.map((item) =>
        answerPlacementQuestion({
          goalId: goal.id,
          input: { answer: RIGHT, durationMs: 9000, itemId: item.id },
        }),
      ),
    );

    const result = await finishGoalPlacement({ goalId: goal.id, input: {} });

    expect(result.status === "ready" && result.completion.knownSkillIds).toStrictEqual([
      skills[2]?.id,
    ]);

    const planItems = await prisma.planItem.findMany({
      select: { skillId: true, status: true },
      where: { plan: { goalId: goal.id }, skillId: { not: null } },
    });

    const statusOf = (index: number) =>
      planItems.find((item) => item.skillId === skills[index]?.id)?.status;

    expect([0, 1, 2, 3].map((index) => statusOf(index))).toStrictEqual([
      "todo",
      "todo",
      "testedOut",
      "todo",
    ]);
  });

  // Pedro-like class test: a miss on the membrane marked every topic built on it unknown, and
  // placement ended after three questions without asking the organelles or the nucleus.
  it("asks every topic of the learner's own material, even after a miss on an early one", async () => {
    const topics = 6;

    const { goal, items, skills, user } = await graphGoalFixture({
      details: { level: "basic" },
      planSkills: Array.from({ length: topics }, (_, index) => ({
        area: "Biologia",
        builds: index === 0 ? null : index - 1,
      })),
    });

    const blueprint = await examBlueprintFixture({ ownerId: user.id });

    // Its questions are written for its own blueprint, as placement asks an exam's own questions.
    await Promise.all([
      prisma.goal.update({
        data: { examBlueprintId: blueprint.id, kind: "exam" },
        where: { id: goal.id },
      }),
      prisma.item.updateMany({
        data: { examBlueprintId: blueprint.id },
        where: { id: { in: items.map((item) => item.id) } },
      }),
    ]);

    const first = await readNext(goal.id);
    expect(first?.next?.skillId).toBe(skills[0]?.id);

    const afterMiss = await answerNext({ answer: DONT_KNOW, goalId: goal.id });
    expect(afterMiss).toMatchObject({ status: "asking" });

    const asked = new Set([first?.next?.skillId]);
    let placement = afterMiss;

    for (let turn = 0; turn < topics * 2 && placement?.status === "asking"; turn += 1) {
      asked.add(placement.next?.skillId);
      // oxlint-disable-next-line no-await-in-loop -- Each answer decides the next question.
      placement = await answerNext({ answer: RIGHT, goalId: goal.id });
    }

    expect(sortIds([...asked])).toStrictEqual(sortIds(skills.map((skill) => skill.id)));
    expect(placement).toMatchObject({ complete: true, status: "done" });

    // Only the topics answered right, and confirmed, count as known; the missed one doesn't.
    expect(sortIds(placement?.knownSkillIds ?? [])).toStrictEqual(
      sortIds(skills.slice(1).map((skill) => skill.id)),
    );
  });

  // The topic placement's questions skipped only got some later, from the test's practice: the
  // answer said placement was done, and reloading the page asked it.
  it("waits for every topic's questions in a test from the learner's own material", async () => {
    const missing = 5;

    const { goal, items, skills, user } = await graphGoalFixture({
      planSkills: Array.from({ length: 7 }, () => ({ area: "Biologia", builds: null })),
      withItems: [0, 1, 2, 3, 4, 6],
    });

    const blueprint = await examBlueprintFixture({ ownerId: user.id });

    await Promise.all([
      prisma.goal.update({
        data: { examBlueprintId: blueprint.id, kind: "exam" },
        where: { id: goal.id },
      }),
      prisma.item.updateMany({
        data: { examBlueprintId: blueprint.id },
        where: { id: { in: items.map((item) => item.id) } },
      }),
    ]);

    let placement = await readNext(goal.id);

    for (let turn = 0; turn < skills.length && placement?.status === "asking"; turn += 1) {
      // oxlint-disable-next-line no-await-in-loop -- Each answer decides the next question.
      placement = await answerNext({ answer: DONT_KNOW, goalId: goal.id });
    }

    expect(placement).toMatchObject({
      complete: false,
      needsItems: [skills[missing]?.id],
      status: "waitingForQuestions",
    });
  });

  it("starts every phase at its beginning from scratch and changes nothing", async () => {
    const { goal, skills, user } = await setup();

    const result = await finishGoalPlacement({ goalId: goal.id, input: { fromScratch: true } });

    // Its first item still stands in for a skill whose lessons aren't outlined: nothing to write.
    expect(result).toMatchObject({ firstLessonId: null, status: "ready" });

    expect(result.status === "ready" && result.completion).toStrictEqual({
      areas: [{ area: null, confident: true, startSkillId: skills[0]?.id }],
      complete: true,
      knownSkillIds: [],
      phases: [
        { confident: true, phase: 0, startSkillId: skills[0]?.id },
        { confident: true, phase: 1, startSkillId: skills[3]?.id },
      ],
      testedOutPlanItemIds: [],
    });

    await expect(prisma.learnerSkill.count({ where: { userId: user.id } })).resolves.toBe(0);
  });
});
