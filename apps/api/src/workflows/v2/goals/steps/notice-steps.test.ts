import { describe, expect, it } from "vitest";
import { claimNoticeLandingStep, endNoticeWaitStep, startNoticeWaitStep } from "./notice-steps";

/** No plan's goal has this id: the database refuses it, as it refuses a write it can't take. */
const UNWRITABLE_GOAL_ID = "not-a-goal-id";

describe("notice wait steps", () => {
  it.each([
    ["starting the wait", startNoticeWaitStep],
    ["claiming the landing", claimNoticeLandingStep],
    ["ending the wait", endNoticeWaitStep],
  ])(
    "throws a write that fails while %s, so the runtime retries it before the run goes on without it",
    async (_name, step) => {
      await expect(step(UNWRITABLE_GOAL_ID)).rejects.toThrow();
    },
  );
});
