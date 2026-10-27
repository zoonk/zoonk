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
import { pickPlanStartToWrite } from "./speculative-lessons";

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
});
