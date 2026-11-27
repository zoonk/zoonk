import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  choiceItemContent,
  itemFixture,
  skillFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { listOwed } from "../../_test-utils/follow-ups";
import { mockSession } from "../../_test-utils/mock-session";
import { pickInPlacement } from "../../_test-utils/shown-choice";
import { analytics } from "../../_test-utils/test-boundaries";
import { askPlacement } from "../_test-utils/exam-test-goal";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { lowGuessTapItems } from "../_test-utils/placement-tap-items";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";
import { type PlacementAnswerInput } from "./placement-contract";

const DONT_KNOW = { dontKnow: true } as const;
/** The right option, wherever placement shows it. */
const RIGHT = "right" as const;

async function setup(phases = [3, 2]) {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ phases, userId: user.id });
  mockSession(user.id);

  return { ...fixture, user };
}

async function answerConfirmationTaps({ goalId, skillId }: { goalId: string; skillId: string }) {
  const taps = await lowGuessTapItems(skillId);

  return taps.reduce<Promise<Awaited<ReturnType<typeof answerPlacementQuestion>> | null>>(
    (previous, { answer, item }) =>
      previous.then(() =>
        answerPlacementQuestion({ goalId, input: { answer, durationMs: 5000, itemId: item.id } }),
      ),
    Promise.resolve(null),
  );
}

const DIFFICULTIES = [-1, 0, 1];

type PlanSkill = {
  area: string | null;
  band?: "beginner" | "intermediate" | "overview";
  builds: number | null;
  phase?: number;
};

async function graphGoalFixture({
  details = {},
  inPlan,
  planSkills,
  withItems = planSkills.map((_, index) => index),
}: {
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

function sortIds(ids: readonly (string | undefined)[]) {
  return ids.toSorted((a, b) => String(a).localeCompare(String(b)));
}

async function readNext(goalId: string) {
  const result = await getGoalPlacement({ goalId });
  return result.status === "ready" ? result.placement : null;
}

type Placement = Awaited<ReturnType<typeof readNext>>;

async function answerNext({
  answer,
  goalId,
  placement,
}: {
  answer: PlacementAnswerInput["answer"] | typeof RIGHT;
  goalId: string;
  placement: Placement;
}): Promise<Placement> {
  const flush = runDeferredWork();
  const itemId = placement?.next?.itemId ?? "";
  const picked = answer === RIGHT ? await pickInPlacement({ itemId }) : answer;

  const result = await answerPlacementQuestion({
    goalId,
    input: { answer: picked, durationMs: 5000, itemId },
  });

  await flush();

  expect(analytics.trackServerEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Test Answered",
      properties: expect.objectContaining({
        answer: "dontKnow" in picked ? "dont_know" : "correct",
        duration_ms: 5000,
        goal_id: goalId,
        question_number: (placement?.focusTest?.sitting?.answered ?? placement?.answered ?? 0) + 1,
        skill_id: placement?.next?.skillId,
      }),
    }),
  );

  return result.status === "ready" ? result.placement : null;
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
      [privateItem, otherExamItem].map(async (item) =>
        answerPlacementQuestion({
          goalId: goal.id,
          input: {
            answer: await pickInPlacement({ itemId: item.id }),
            durationMs: 5000,
            itemId: item.id,
          },
        }),
      ),
    );

    expect(answers).toStrictEqual([{ status: "invalidItem" }, { status: "invalidItem" }]);
  });
});

describe(finishGoalPlacement, () => {
  it("tests out only the topics its answers checked in a test from the learner's own material", async () => {
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
      organelles.map(async (item) =>
        answerPlacementQuestion({
          goalId: goal.id,
          input: {
            answer: await pickInPlacement({ itemId: item.id }),
            durationMs: 9000,
            itemId: item.id,
          },
        }),
      ),
    );

    await answerConfirmationTaps({ goalId: goal.id, skillId: skills[2]!.id });

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

    const bank = await Promise.all(skills.map((skill) => lowGuessTapItems(skill.id)));
    const taps = bank.flat();
    const tapAnswers = new Map(taps.map(({ answer, item }) => [item.id, answer]));
    const first = await askPlacement(goal.id);
    expect(first?.next?.skillId).toBe(skills[0]?.id);

    const afterMiss = await answerNext({ answer: DONT_KNOW, goalId: goal.id, placement: first });
    expect(afterMiss).toMatchObject({ status: "asking" });

    const asked = new Set([first?.next?.skillId]);
    let placement = afterMiss;

    for (let turn = 0; turn < topics * 4; turn += 1) {
      // A sitting that reached its count gives way to the next one.
      // oxlint-disable-next-line no-await-in-loop -- Each answer decides the next question.
      const asking = placement?.next ? placement : await askPlacement(goal.id);

      if (!asking?.next) {
        break;
      }

      asked.add(asking.next.skillId);
      // oxlint-disable-next-line no-await-in-loop -- Each answer decides the next question.
      placement = await answerNext({
        answer: tapAnswers.get(asking.next.itemId) ?? RIGHT,
        goalId: goal.id,
        placement: asking,
      });
    }

    expect(sortIds([...asked])).toStrictEqual(sortIds(skills.map((skill) => skill.id)));
    expect(placement).toMatchObject({ complete: true, status: "done" });

    expect(sortIds(placement?.knownSkillIds ?? [])).toStrictEqual(
      sortIds(skills.slice(1).map((skill) => skill.id)),
    );
  });

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

    let placement = await askPlacement(goal.id);

    for (const _ of skills) {
      // A sitting that reached its count gives way to the next one.
      // oxlint-disable-next-line no-await-in-loop -- Each answer decides the next question.
      const asking = placement?.next ? placement : await askPlacement(goal.id);
      placement = asking;

      if (!asking?.next) {
        break;
      }

      // oxlint-disable-next-line no-await-in-loop -- Each answer decides the next question.
      placement = await answerNext({ answer: DONT_KNOW, goalId: goal.id, placement: asking });
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

    expect(result).toMatchObject({ status: "ready" });

    await expect(listOwed(user.id)).resolves.toMatchObject([
      { key: goal.id, kind: "prepareGoalLessons" },
    ]);

    expect(result.status === "ready" && result.completion).toStrictEqual({
      areas: [{ area: null, confident: true, startSkillId: skills[0]?.id }],
      changeId: null,
      complete: true,
      focusTest: null,
      knownSkillIds: [],
      lessonsSkipped: 0,
      phases: [
        { confident: true, phase: 0, startSkillId: skills[0]?.id },
        { confident: true, phase: 1, startSkillId: skills[3]?.id },
      ],
      testedOutPlanItemIds: [],
    });

    await expect(prisma.learnerSkill.count({ where: { userId: user.id } })).resolves.toBe(0);
  });
});
