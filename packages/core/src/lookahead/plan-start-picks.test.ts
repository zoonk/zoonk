import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WAITING_START,
  outlineSkill,
  waitingGoal,
} from "../library/curriculum/_test-utils/waiting-goals";
import {
  mockDecision,
  mockSearchTerms,
  uniqueWord,
} from "../library/identity/_test-utils/identity-mocks";
import { markPlanInputsUntil } from "../plans/_test-utils/mark-plan-inputs";
import { admitPlanLessons, pickPlanStartToWrite } from "./speculative-lessons";

/** A waiting goal whose skill's band landed: its lessons, which the saved plan doesn't have yet. */
async function landedBand() {
  const skill = await skillFixture();
  const { goal, plan } = await waitingGoal(skill);
  const lessonIds = await outlineSkill(skill);

  return { goal, lessonIds, plan, skill };
}

describe("lessons picked and started while a plan's band lands", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WAITING_START);
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The band a learner waits on landed, but the run planning it in their plan still waits its turn
  // behind their own onboarding (placement and question banks keep marking the plan): the first
  // lesson to write is the band's, picked from the plan worked out now, never the stand-in saved.
  it("picks the band's first lesson while the learner's onboarding keeps changing the plan", async () => {
    const { goal, lessonIds, plan } = await landedBand();
    const stop = new AbortController();
    const marking = markPlanInputsUntil({ planId: plan.id, signal: stop.signal });
    const picking = pickPlanStartToWrite(goal.id);

    await Promise.allSettled([picking.finally(() => stop.abort()), marking]);

    await expect(marking).resolves.toBeGreaterThan(0);
    await expect(picking).resolves.toBe(lessonIds[0]);
  });

  // The plan worked out now has the band's lessons before its save lands: they start.
  it("starts the lessons the plan worked out now has, saved or not yet", async () => {
    const { goal, lessonIds } = await landedBand();

    await expect(admitPlanLessons({ goalId: goal.id, lessonIds })).resolves.toStrictEqual(
      lessonIds,
    );
  });

  // Placement found the learner knows the skill after its lessons were picked, testing out the
  // stand-in the saved plan still has: none of the skill's lessons start.
  it("leaves out the lessons of a skill placement tested out since they were picked", async () => {
    const { goal, lessonIds, plan, skill } = await landedBand();

    await prisma.planItem.updateMany({
      data: { status: "testedOut" },
      where: { lessonId: null, planId: plan.id, skillId: skill.id },
    });

    await expect(admitPlanLessons({ goalId: goal.id, lessonIds })).resolves.toStrictEqual([]);
  });

  // The learner paused the goal after its lessons were picked: none start.
  it("starts nothing for a goal the learner paused since its lessons were picked", async () => {
    const { goal, lessonIds } = await landedBand();
    await pickPlanStartToWrite(goal.id);

    await prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } });

    await expect(admitPlanLessons({ goalId: goal.id, lessonIds })).resolves.toStrictEqual([]);
  });

  // Every lesson is done when another chapter of the skill lands: the plan offers its lessons
  // rather than adding them, so none start before the learner says yes.
  it("starts no lesson a finished plan only offers", async () => {
    const { goal, plan, skill } = await landedBand();
    await pickPlanStartToWrite(goal.id);

    await prisma.planItem.updateMany({
      data: { status: "done" },
      where: { kind: "lesson", planId: plan.id },
    });

    const offered = await outlineSkill(skill);

    await expect(admitPlanLessons({ goalId: goal.id, lessonIds: offered })).resolves.toStrictEqual(
      [],
    );
  });

  // The plan saved the band's lessons, then the learner finished the first one: the rest start.
  it("leaves out a lesson the learner finished since it was picked", async () => {
    const { goal, lessonIds, plan } = await landedBand();
    await pickPlanStartToWrite(goal.id);
    const [finished, ...rest] = lessonIds;

    await prisma.planItem.updateMany({
      data: { status: "done" },
      where: { lessonId: finished, planId: plan.id },
    });

    await expect(admitPlanLessons({ goalId: goal.id, lessonIds })).resolves.toStrictEqual(rest);
  });
});
