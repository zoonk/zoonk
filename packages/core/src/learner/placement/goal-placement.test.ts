import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import {
  choiceItemContent,
  itemFixture,
  skillFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";

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

type Placement = Awaited<ReturnType<typeof readNext>>;

/** Answers the question `placement` asks; an answer returns the placement with the next one. */
async function answerNext({
  answer,
  goalId,
  placement,
}: {
  answer: typeof RIGHT | typeof DONT_KNOW;
  goalId: string;
  placement: Placement;
}): Promise<Placement> {
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

  it("counts only this goal's placement answers: not another goal's, a lesson's or a session's on the same skills", async () => {
    const { goal, items, skills, user } = await graphGoalFixture({ planSkills: CHAIN });
    const lesson = await libraryLessonFixture();

    const [step, session] = await Promise.all([
      libraryStepFixture({ lessonId: lesson.id }),
      studySessionFixture({ goalId: goal.id, userId: user.id }),
    ]);

    await Promise.all([
      // Another goal's placement asked about the same skill before this goal existed.
      attemptFixture({
        answeredAt: new Date(goal.createdAt.getTime() - 60_000),
        itemId: items[0]?.id,
        skillId: skills[0]?.id,
        userId: user.id,
      }),
      attemptFixture({ skillId: skills[0]?.id, stepId: step.id, userId: user.id }),
      attemptFixture({
        itemId: items[1]?.id,
        skillId: skills[0]?.id,
        studySessionId: session.id,
        userId: user.id,
      }),
    ]);

    const before = await readNext(goal.id);
    const after = await answerNext({ answer: RIGHT, goalId: goal.id, placement: before });

    expect(before).toMatchObject({ answered: 0, started: false });
    expect(after).toMatchObject({ answered: 1, started: true });
  });

  it("sends the question, its options, how many to pick and its picture, chart or timeline only: nothing that tells the answer", async () => {
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
      "select",
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
    const first = await readNext(goal.id);

    expect(first).toMatchObject({ next: { skillId: skills[1]?.id } });

    await expect(
      answerNext({ answer: RIGHT, goalId: goal.id, placement: first }),
    ).resolves.toMatchObject({ next: null, status: "waitingForQuestions" });
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

    const afterRight = await answerNext({ answer: RIGHT, goalId: right.goal.id, placement: first });

    expect(afterRight?.next?.skillId).toBe(right.skills[2]?.id);
    expect(difficultyOf({ itemId: afterRight?.next?.itemId, items: right.items })).toBe(1);

    const wrong = await graphGoalFixture({ planSkills: CHAIN });

    const afterWrong = await answerNext({
      answer: DONT_KNOW,
      goalId: wrong.goal.id,
      placement: await readNext(wrong.goal.id),
    });

    expect(afterWrong?.next?.skillId).toBe(wrong.skills[0]?.id);
    expect(difficultyOf({ itemId: afterWrong?.next?.itemId, items: wrong.items })).toBe(-1);
  });

  it("asks every subject of the exam, the ones the plan's time leaves out included", async () => {
    const { goal, skills } = await graphGoalFixture({
      inPlan: ESSAY_ONLY_PLAN,
      planSkills: ESSAY_FIRST_EXAM,
    });

    const areaOf = (skillId?: string) =>
      ESSAY_FIRST_EXAM[skills.findIndex((skill) => skill.id === skillId)]?.area;

    const first = await readNext(goal.id);
    const second = await answerNext({ answer: RIGHT, goalId: goal.id, placement: first });
    const third = await answerNext({ answer: RIGHT, goalId: goal.id, placement: second });

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

    const first = await readNext(goal.id);

    expect(first).toMatchObject({ next: { skillId: skills[0]?.id } });

    // "I don't know yet" on the essay's first skill settles where the essay starts.
    await expect(
      answerNext({ answer: DONT_KNOW, goalId: goal.id, placement: first }),
    ).resolves.toMatchObject({ complete: false, next: null, status: "waitingForQuestions" });

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

  // A right answer is evidence about its own skill only: what it builds on waits to be confirmed by
  // answers of its own.
  it("takes only the answered skill as known, moves to harder skills and never repeats a question", async () => {
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

    expect(second.status === "ready" && second.placement.knownSkillIds).toStrictEqual([
      skills[2]?.id,
    ]);

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
    const knownIds = [skills[2]?.id ?? ""];

    // The skills it builds on keep their lessons until answers of their own confirm them.
    expect(result.status === "ready" && result.completion).toMatchObject({
      knownSkillIds: knownIds,
      testedOutPlanItemIds: [planItems[2]?.id],
    });

    const learnerSkills = await prisma.learnerSkill.findMany({ where: { userId: user.id } });
    expect(learnerSkills.map((row) => row.skillId).toSorted()).toStrictEqual(knownIds.toSorted());
    expect(learnerSkills.every((row) => row.reps > 0 && row.due !== null)).toBe(true);

    const statuses = await prisma.planItem.findMany({
      select: { id: true, status: true },
      where: { id: { in: [planItems[1]?.id ?? "", planItems[3]?.id ?? ""] } },
    });

    expect(statuses.map((item) => item.status)).toStrictEqual(["todo", "todo"]);
  });

  it("names the lesson the plan opens with once placement tested some out, so it's written now", async () => {
    const { goal, items, planItems, skills } = await setup();
    const lessons = await Promise.all(planItems.map(() => libraryLessonFixture()));

    await Promise.all(
      planItems.map((item, index) =>
        prisma.planItem.update({ data: { lessonId: lessons[index]?.id }, where: { id: item.id } }),
      ),
    );

    const known = items.filter((item) => item.skillId === skills[0]?.id);

    await Promise.all(
      known.map((item) =>
        answerPlacementQuestion({
          goalId: goal.id,
          input: { answer: RIGHT, durationMs: 9000, itemId: item.id },
        }),
      ),
    );

    const result = await finishGoalPlacement({ goalId: goal.id, input: {} });

    // The first skill is known: the plan now opens with the second one's lesson.
    expect(result).toMatchObject({ firstLessonId: lessons[1]?.id, status: "ready" });
  });

  // The bands below a stated level are the learner's word only: placement asks them first, and
  // skips only what their own answers confirm.
  it("never skips the bands below a stated level before their own answers: it asks them first", async () => {
    const { goal, skills } = await graphGoalFixture({
      details: { level: "intermediate" },
      planSkills: BANDED_EXAM,
    });

    const placement = await readNext(goal.id);

    // Law's overview and beginner skills, and English's beginner one.
    expect([skills[0]?.id, skills[1]?.id, skills[3]?.id]).toContain(placement?.next?.skillId);

    await expect(finishGoalPlacement({ goalId: goal.id, input: {} })).resolves.toMatchObject({
      completion: { knownSkillIds: [], testedOutPlanItemIds: [] },
      status: "ready",
    });
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

  it("never skips the basics of a subject the learner says they know well: it asks them first", async () => {
    const { goal, skills } = await graphGoalFixture({
      details: { knownSubjects: ["Law"] },
      planSkills: BANDED_EXAM,
    });

    const first = await readNext(goal.id);

    expect(first).toMatchObject({ next: { skillId: skills[0]?.id } });

    await expect(finishGoalPlacement({ goalId: goal.id, input: {} })).resolves.toMatchObject({
      completion: { knownSkillIds: [] },
    });

    // Its own right answer confirms it, and only then is it skipped.
    await answerNext({ answer: RIGHT, goalId: goal.id, placement: first });

    await expect(finishGoalPlacement({ goalId: goal.id, input: {} })).resolves.toMatchObject({
      completion: { knownSkillIds: [skills[0]?.id] },
    });
  });

  it("asks a known subject's foundations first when the exam asks all of it at one band, skipping none on its word", async () => {
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

    await expect(readNext(goal.id)).resolves.toMatchObject({ next: { skillId: skills[0]?.id } });
    const result = await finishGoalPlacement({ goalId: goal.id, input: {} });

    expect(result.status === "ready" && result.completion.knownSkillIds).toStrictEqual([]);

    const items = await prisma.planItem.findMany({
      select: { skillId: true, status: true },
      where: { plan: { goalId: goal.id }, skillId: { not: null } },
    });

    expect(items.every((item) => item.status === "todo")).toBe(true);
  });

  // Sofia knows the OAB's administrative law well: its skill graph put five of its six topics in
  // the first phase, and all five were skipped as its basics, with the sixth from her one right answer.
  // Only what its later topics build on is a basic; the other first-phase topics are the subject.
  it("asks first only what a known subject's later topics build on", async () => {
    const { goal, skills } = await graphGoalFixture({
      details: { knownSubjects: ["Administrative law"] },
      planSkills: [
        { area: "Administrative law", band: "intermediate", builds: null, phase: 0 },
        { area: "Administrative law", band: "intermediate", builds: null, phase: 0 },
        { area: "Administrative law", band: "intermediate", builds: null, phase: 0 },
        { area: "Math", band: "intermediate", builds: null, phase: 0 },
        { area: "Administrative law", band: "intermediate", builds: 0, phase: 1 },
      ],
    });

    await expect(readNext(goal.id)).resolves.toMatchObject({ next: { skillId: skills[0]?.id } });

    await expect(finishGoalPlacement({ goalId: goal.id, input: {} })).resolves.toMatchObject({
      completion: { knownSkillIds: [] },
    });
  });

  it("tests out a basic its own answer confirms even while the plan's time leaves it out", async () => {
    // Before the learner picks their time, the plan holds only what the default time fits: here
    // none of Portuguese's basics. Once they pick more time, a re-plan must not bring them back.
    const { goal, items, skills } = await graphGoalFixture({
      details: { knownSubjects: ["Portuguese"] },
      inPlan: [1, 2, 3],
      planSkills: [
        { area: "Portuguese", band: "intermediate", builds: null, phase: 0 },
        { area: "Math", band: "intermediate", builds: null, phase: 0 },
        { area: "Portuguese", band: "intermediate", builds: 0, phase: 1 },
        { area: "Math", band: "intermediate", builds: 1, phase: 1 },
      ],
    });

    await answerPlacementQuestion({
      goalId: goal.id,
      input: {
        answer: RIGHT,
        durationMs: 5000,
        itemId: items.find((item) => item.skillId === skills[0]?.id)?.id ?? "",
      },
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

  it("never takes the basics a right answer builds on as known: only the skill it answered", async () => {
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

    expect(result.status === "ready" && result.completion.knownSkillIds).toStrictEqual([
      skills[2]?.id,
    ]);
  });

  it("takes a topic answered right once as known, never one it missed or a true-or-false guess", async () => {
    // Sofia answered ten OAB questions right, one each, and every one of their topics still had
    // its lessons on day one.
    const { goal, items, skills, user } = await graphGoalFixture({
      planSkills: [
        { area: "Ethics", band: "intermediate", builds: null },
        { area: "Civil", band: "intermediate", builds: null },
        { area: "Penal", band: "intermediate", builds: null },
        { area: "Labor", band: "intermediate", builds: null },
      ],
    });

    const skillAt = (index: number) => skills[index]?.id ?? "";
    const itemOf = (index: number) => items.find((item) => item.skillId === skillAt(index))?.id;

    const statement = await itemFixture({
      content: {
        context: null,
        isTrue: true,
        misconception: null,
        reason: "The rule says so.",
        statement: "The rule applies here.",
      },
      format: "trueFalse",
      skillId: skillAt(1),
    });

    const answer = (attrs: { at: number; isCorrect: boolean; itemId?: string; skill: number }) =>
      attemptFixture({
        answeredAt: new Date(Date.now() - 60_000 + attrs.at),
        isCorrect: attrs.isCorrect,
        itemId: attrs.itemId ?? itemOf(attrs.skill),
        skillId: skillAt(attrs.skill),
        userId: user.id,
      });

    await Promise.all([
      answer({ at: 0, isCorrect: true, skill: 0 }),
      answer({ at: 0, isCorrect: true, itemId: statement.id, skill: 1 }),
      answer({ at: 0, isCorrect: true, skill: 2 }),
      answer({ at: 1000, isCorrect: false, skill: 2 }),
    ]);

    const result = await finishGoalPlacement({ goalId: goal.id, input: {} });

    expect(result).toMatchObject({ completion: { knownSkillIds: [skillAt(0)] }, status: "ready" });

    const planItems = await prisma.planItem.findMany({
      where: { plan: { goalId: goal.id }, skillId: { not: null } },
    });

    const statusOf = (index: number) =>
      planItems.find((item) => item.skillId === skillAt(index))?.status;

    expect([0, 1, 2, 3].map((index) => statusOf(index))).toStrictEqual([
      "testedOut",
      "todo",
      "todo",
      "todo",
    ]);
  });

  it("never takes a topic the learner asked to focus on as known from one answer", async () => {
    // Pedro asked the buddy to focus on the organelle table; a placement answer the day before his
    // test took it as known and skipped it.
    const { goal, items, skills, user } = await graphGoalFixture({
      planSkills: [
        { area: "Biology", band: "intermediate", builds: null },
        { area: "Cells", band: "intermediate", builds: null },
      ],
    });

    const skillAt = (index: number) => skills[index]?.id ?? "";
    const itemsOf = (index: number) => items.filter((item) => item.skillId === skillAt(index));

    await prisma.plan.update({
      data: {
        settings: {
          focusAreas: ["Cells"],
          focusParts: [{ area: "Cells", name: "Organelle table", skillIds: [skillAt(1)] }],
        },
      },
      where: { goalId: goal.id },
    });

    const answerRight = ({ at, item, skill }: { at: number; item: number; skill: number }) =>
      attemptFixture({
        answeredAt: new Date(Date.now() - 60_000 + at),
        isCorrect: true,
        itemId: itemsOf(skill)[item]?.id,
        skillId: skillAt(skill),
        userId: user.id,
      });

    await Promise.all([
      answerRight({ at: 0, item: 0, skill: 0 }),
      answerRight({ at: 0, item: 0, skill: 1 }),
    ]);

    await expect(finishGoalPlacement({ goalId: goal.id, input: {} })).resolves.toMatchObject({
      completion: { knownSkillIds: [skillAt(0)] },
    });

    // Its own second right answer, and it's known.
    await answerRight({ at: 1000, item: 1, skill: 1 });
    const again = await finishGoalPlacement({ goalId: goal.id, input: {} });

    expect(again.status === "ready" && sortIds(again.completion.knownSkillIds)).toStrictEqual(
      sortIds([skillAt(0), skillAt(1)]),
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

    const afterMiss = await answerNext({ answer: DONT_KNOW, goalId: goal.id, placement: first });
    expect(afterMiss).toMatchObject({ status: "asking" });

    const asked = new Set([first?.next?.skillId]);
    let placement = afterMiss;

    for (let turn = 0; turn < topics * 2 && placement?.status === "asking"; turn += 1) {
      asked.add(placement.next?.skillId);
      // oxlint-disable-next-line no-await-in-loop -- Each answer decides the next question.
      placement = await answerNext({ answer: RIGHT, goalId: goal.id, placement });
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
      placement = await answerNext({ answer: DONT_KNOW, goalId: goal.id, placement });
    }

    expect(placement).toMatchObject({
      complete: false,
      needsItems: [skills[missing]?.id],
      status: "waitingForQuestions",
    });
  });

  it("starts every phase at its beginning from scratch and changes nothing", async () => {
    const { goal, plan, planItems, skills, user } = await setup();

    await prisma.lesson.deleteMany({
      where: { id: { in: planItems.flatMap((item) => item.lessonId ?? []) } },
    });

    await prisma.planItem.updateMany({ data: { chapterId: null }, where: { planId: plan.id } });

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
