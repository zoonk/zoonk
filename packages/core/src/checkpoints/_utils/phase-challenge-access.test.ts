import { describe, expect, it } from "vitest";
import { toBlockPayload } from "../../sessions/block-payload";
import {
  shouldRefillAfterEntitlementLapse,
  withoutLockedPhaseChallenges,
} from "./phase-challenge-access";

const call = {
  kind: "checkpoint" as const,
  payload: toBlockPayload({
    checkpoint: {
      kind: "boss",
      mock: false,
      passMark: 0,
      phase: 0,
      rematch: false,
      timeLimitMinutes: 15,
    },
  }),
  status: "pending" as const,
};

describe("shown-day refill boundary", () => {
  it("refills a whole day removed by an entitlement lapse", () => {
    expect(
      withoutLockedPhaseChallenges({ blocks: [call], phaseChallengesRequired: false }),
    ).toStrictEqual([]);

    expect(
      shouldRefillAfterEntitlementLapse({ blocks: [call], phaseChallengesRequired: false }),
    ).toBe(true);

    expect(
      shouldRefillAfterEntitlementLapse({ blocks: [call], phaseChallengesRequired: true }),
    ).toBe(false);
  });

  it("does not refill an unavailable lesson's reserved slot", () => {
    const unavailable = {
      kind: "learn" as const,
      payload: toBlockPayload({ title: "Unavailable lesson" }),
      status: "pending" as const,
    };

    expect(
      withoutLockedPhaseChallenges({ blocks: [unavailable], phaseChallengesRequired: false }),
    ).toStrictEqual([unavailable]);

    expect(
      shouldRefillAfterEntitlementLapse({ blocks: [unavailable], phaseChallengesRequired: false }),
    ).toBe(false);
  });
});
