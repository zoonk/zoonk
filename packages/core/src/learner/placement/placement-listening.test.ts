import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { listeningGoalFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { loadGoalPlan } from "../_utils/goal-skill-graph";
import { pickSessionPlacementItems } from "./_utils/session-placement-items";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";

const RIGHT = { selectedIndex: 0 };

const MAX_QUESTIONS = 8;

async function setup() {
  const fixture = await listeningGoalFixture();
  const { blueprint, listeningSkills, reading, user } = fixture;

  const [onReading, ...onListening] = await Promise.all(
    [reading, ...listeningSkills].map((skill) =>
      itemFixture({
        content: choiceItemContent(),
        examBlueprintId: blueprint.id,
        skillId: skill.id,
      }),
    ),
  );

  mockSession(user.id);
  return { ...fixture, onListening, onReading };
}

async function answerEveryQuestion({
  asked = [],
  goalId,
}: {
  asked?: string[];
  goalId: string;
}): Promise<{ asked: string[]; status: string | null }> {
  const result = await getGoalPlacement({ goalId });
  const placement = result.status === "ready" ? result.placement : null;
  const next = placement?.next;

  if (!next || asked.length >= MAX_QUESTIONS) {
    return { asked, status: placement?.status ?? null };
  }

  await answerPlacementQuestion({
    goalId,
    input: { answer: RIGHT, durationMs: 5000, itemId: next.itemId },
  });

  return answerEveryQuestion({ asked: [...asked, next.skillId], goalId });
}

describe("placement on an exam whose listening is practiced only with recordings", () => {
  it("never asks or waits for a listening skill, and is done once the rest is placed", async () => {
    const { goal, listeningSkills, reading } = await setup();
    const listening = new Set(listeningSkills.map((skill) => skill.id));

    await prisma.plan.update({
      data: { placementPreparedAt: new Date() },
      where: { goalId: goal.id },
    });

    const { asked, status } = await answerEveryQuestion({ goalId: goal.id });

    expect(asked).toStrictEqual([reading.id]);
    expect(status).toBe("done");

    const placement = await getGoalPlacement({ goalId: goal.id });

    expect(
      placement.status === "ready" &&
        placement.placement.needsItems.some((id) => listening.has(id)),
    ).toBe(false);
  });

  it("asks nothing before its exam's blueprint is linked, so a listening skill never gets a text question", async () => {
    const { blueprint, goal, listeningSkills, reading } = await setup();
    const listening = new Set(listeningSkills.map((skill) => skill.id));

    await Promise.all([
      prisma.goal.update({ data: { examBlueprintId: null }, where: { id: goal.id } }),
      ...[reading, ...listeningSkills].map((skill) =>
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      ),
    ]);

    const waiting = await getGoalPlacement({ goalId: goal.id });

    expect(waiting.status === "ready" && waiting.placement).toMatchObject({
      next: null,
      status: "preparing",
    });

    await prisma.goal.update({ data: { examBlueprintId: blueprint.id }, where: { id: goal.id } });

    await prisma.plan.update({
      data: { placementPreparedAt: new Date() },
      where: { goalId: goal.id },
    });

    const { asked } = await answerEveryQuestion({ goalId: goal.id });

    expect(asked.length).toBeGreaterThan(0);
    expect(asked.filter((id) => listening.has(id))).toStrictEqual([]);
  });

  it("never skips a listening skill's lessons on a right answer to a text question about it", async () => {
    const { goal, listeningSkills, onListening, user } = await setup();
    const [heard] = onListening;

    await attemptFixture({
      isCorrect: true,
      itemId: heard?.id ?? null,
      skillId: heard?.skillId ?? null,
      userId: user.id,
    });

    const result = await finishGoalPlacement({ goalId: goal.id, input: {} });
    const known = result.status === "ready" ? result.completion.knownSkillIds : [];

    expect(known.filter((id) => listeningSkills.some((skill) => skill.id === id))).toStrictEqual(
      [],
    );
  });

  it("never asks a listening skill's text question in the first week's sessions", async () => {
    const { goal, onReading, user } = await setup();
    const plan = await loadGoalPlan(goal.id);

    const picked = await pickSessionPlacementItems({
      areaShares: null,
      excludeItemIds: new Set(),
      focusAreas: [],
      goal,
      limit: MAX_QUESTIONS,
      quickFormat: "multipleChoice",
      skills: plan.skills,
      userId: user.id,
    });

    expect(picked).toStrictEqual([onReading?.id]);
  });
});
