import { skillFixture } from "@zoonk/testing/fixtures/skills";
import * as logger from "@zoonk/utils/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markPlanInputsUntil } from "../../plans/_test-utils/mark-plan-inputs";
import { mockDecision, mockSearchTerms, uniqueWord } from "../identity/_test-utils/identity-mocks";
import {
  WAITING_START,
  outlineSkill,
  plannedLessons,
  waitingGoal,
} from "./_test-utils/waiting-goals";
import { replanGoalsWaitingOnSkills, replanWaitingGoal } from "./replan-waiting-goals";

/** A popular course's band: more waiting goals than a process's pool has connections. */
const POPULAR_BAND_GOALS = 12;

describe(replanGoalsWaitingOnSkills, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WAITING_START);
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Other learners' outlines keep saving lessons of the shared course while a band lands, each
  // marking one waiting plan's inputs changed: that plan can't be saved from what it read, so it's
  // reported (and logged) for its run to plan again later, keeping its stand-in meanwhile, while
  // the other goal takes the lessons. Once the lessons stop landing, planning it again takes them.
  it("reports a goal whose plan kept changing, for later, and re-plans the others", async () => {
    const skill = await skillFixture();
    const [busy, other] = await Promise.all([waitingGoal(skill), waitingGoal(skill)]);
    const lessonIds = await outlineSkill(skill);
    const error = vi.spyOn(logger, "logError");
    const stop = new AbortController();
    const marking = markPlanInputsUntil({ planId: busy.plan.id, signal: stop.signal });
    const replanning = replanGoalsWaitingOnSkills({ skillIds: [skill.id] });

    await Promise.allSettled([replanning.finally(() => stop.abort()), marking]);

    await expect(marking).resolves.toBeGreaterThan(0);

    await expect(replanning).resolves.toStrictEqual({
      failedGoalIds: [busy.goal.id],
      goalIds: [other.goal.id],
    });

    expect(error).toHaveBeenCalledExactlyOnceWith(
      `Could not re-plan goal ${busy.goal.id} with the lessons it waited for.`,
      expect.objectContaining({ name: "PlanConflictError" }),
    );

    await expect(plannedLessons(busy.plan.id)).resolves.toStrictEqual([skill.id]);
    await expect(plannedLessons(other.plan.id)).resolves.toStrictEqual(lessonIds);

    await replanWaitingGoal(busy.goal.id);
    await expect(plannedLessons(busy.plan.id)).resolves.toStrictEqual(lessonIds);
  });

  // A popular course's band: every goal waiting on it takes the lessons.
  it("re-plans every goal waiting on a popular course's band", async () => {
    const skill = await skillFixture();

    const waiting = await Promise.all(
      Array.from({ length: POPULAR_BAND_GOALS }, () => waitingGoal(skill)),
    );

    const lessonIds = await outlineSkill(skill);
    const replanned = await replanGoalsWaitingOnSkills({ skillIds: [skill.id] });

    expect(replanned.failedGoalIds).toStrictEqual([]);

    expect(replanned.goalIds.toSorted()).toStrictEqual(
      waiting.map(({ goal }) => goal.id).toSorted(),
    );

    const planned = await Promise.all(waiting.map(({ plan }) => plannedLessons(plan.id)));
    expect(planned).toStrictEqual(waiting.map(() => lessonIds));
  });
});
