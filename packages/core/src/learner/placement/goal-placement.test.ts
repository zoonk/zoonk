import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
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

type PlanSkill = { area: string | null; builds: number | null };

/**
 * A goal whose skill graph lists `planSkills` in plan order, one phase, each skill building on the
 * one `builds` points at, with one question per difficulty for each skill in `withItems`.
 */
async function graphGoalFixture({
  planSkills,
  withItems = planSkills.map((_, index) => index),
}: {
  planSkills: PlanSkill[];
  withItems?: number[];
}) {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });

  const skills = await Promise.all(
    planSkills.map((_, index) => skillFixture({ name: `Graph skill ${index + 1}` })),
  );

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Phase 1" }],
      skills: skills.map((skill, index) => ({
        area: planSkills[index]?.area ?? null,
        lessons: 1,
        name: skill.name,
        phase: 0,
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
      skills.map((skill, position) =>
        planItemFixture({ phase: 0, planId: plan.id, position, skillId: skill.id }),
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

  it("sends the question and its options only: nothing that tells the answer", async () => {
    const { goal } = await setup();
    const result = await getGoalPlacement({ goalId: goal.id });
    const next = result.status === "ready" ? result.placement.next : null;

    expect(Object.keys(next ?? {}).toSorted()).toStrictEqual([
      "context",
      "format",
      "itemId",
      "options",
      "question",
      "skillId",
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

  it("waits for the question it asks first while it's written, instead of asking one that's ready", async () => {
    // Placement starts in the middle; only the first skill's questions are written so far.
    const { goal, skills } = await graphGoalFixture({ planSkills: CHAIN, withItems: [0] });

    await expect(readNext(goal.id)).resolves.toMatchObject({
      next: null,
      status: "waitingForQuestions",
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

    await prisma.goal.update({
      data: { examBlueprintId: trueFalseExam.id },
      where: { id: goal.id },
    });

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

  it("rejects a question from outside the goal", async () => {
    const { goal } = await setup();
    const otherSkill = await skillFixture();
    const otherItem = await itemFixture({ content: choiceItemContent(), skillId: otherSkill.id });

    const result = await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: RIGHT, durationMs: 5000, itemId: otherItem.id },
    });

    expect(result).toStrictEqual({ status: "invalidItem" });
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
