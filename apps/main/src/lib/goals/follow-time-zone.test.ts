import { describe, expect, it } from "vitest";
import {
  type SentTimeZoneFollow,
  createTimeZoneFollows,
  settleTimeZoneFollow,
  shouldFollowTimeZone,
} from "./follow-time-zone";

const DEVICE = "Pacific/Kiritimati";
const SAVED = "America/Sao_Paulo";

/** The learner summary as Today holds it: read at `readAt`, at `revision`, with the goal's zone. */
function summaryOf({ readAt = 100, revision = "4", timeZone = SAVED } = {}) {
  return { readAt, revision, timeZone };
}

function sentOf(until: SentTimeZoneFollow["until"], { request = 1, timeZone = DEVICE } = {}) {
  return { request, timeZone, until };
}

describe("following the device's zone from Today", () => {
  it("asks while the goal's saved zone isn't the device's, and never once it is", () => {
    expect(shouldFollowTimeZone({ deviceZone: DEVICE, summary: summaryOf() })).toBe(true);

    expect(
      shouldFollowTimeZone({ deviceZone: DEVICE, summary: summaryOf({ timeZone: DEVICE }) }),
    ).toBe(false);
  });

  it("never asks again while an ask is out, even once a newer summary is past any deadline", () => {
    const sent = sentOf({ inFlight: true });

    // Back on Today with an old summary: its fresh read arrives, still the old zone.
    expect(
      shouldFollowTimeZone({ deviceZone: DEVICE, sent, summary: summaryOf({ readAt: 1e12 }) }),
    ).toBe(false);
  });

  it("never asks again for a move until the summary catches up with its revision", () => {
    const sent = sentOf({ learnerRevision: "5" });

    // Today mounts again (its refresh) before a summary read after the move arrives.
    expect(shouldFollowTimeZone({ deviceZone: DEVICE, sent, summary: summaryOf() })).toBe(false);

    expect(
      shouldFollowTimeZone({ deviceZone: DEVICE, sent, summary: summaryOf({ revision: "5" }) }),
    ).toBe(true);
  });

  it("asks again for a day that couldn't move only once a summary is read at its next day", () => {
    const sent = sentOf({ readAt: 1000 });

    expect(shouldFollowTimeZone({ deviceZone: DEVICE, sent, summary: summaryOf() })).toBe(false);

    expect(
      shouldFollowTimeZone({ deviceZone: DEVICE, sent, summary: summaryOf({ readAt: 1000 }) }),
    ).toBe(true);
  });

  it("asks for a new device zone even while another one's follow is out", () => {
    const sent = sentOf({ inFlight: true }, { timeZone: "Asia/Tokyo" });

    expect(shouldFollowTimeZone({ deviceZone: DEVICE, sent, summary: summaryOf() })).toBe(true);
  });
});

describe("following a device that moves on and comes back", () => {
  const GOAL = "goal-a";

  it("never asks twice for a zone while its ask is out, after asking for another meanwhile", () => {
    const follows = createTimeZoneFollows();
    const summary = summaryOf();

    const tokyo = follows.begin({ deviceZone: "Asia/Tokyo", goalId: GOAL, summary });
    const kiritimati = follows.begin({ deviceZone: DEVICE, goalId: GOAL, summary });

    expect(tokyo?.timeZone).toBe("Asia/Tokyo");
    expect(kiritimati?.timeZone).toBe(DEVICE);

    // Back in Tokyo with Tokyo's ask still out, and a fresh summary past any deadline.
    expect(
      follows.begin({
        deviceZone: "Asia/Tokyo",
        goalId: GOAL,
        summary: summaryOf({ readAt: 1e12 }),
      }),
    ).toBeUndefined();
  });

  it("settles each zone's ask on its own, so a late answer leaves the other zone's alone", () => {
    const follows = createTimeZoneFollows();
    const tokyo = follows.begin({ deviceZone: "Asia/Tokyo", goalId: GOAL, summary: summaryOf() });
    const kiritimati = follows.begin({ deviceZone: DEVICE, goalId: GOAL, summary: summaryOf() });

    follows.settle({
      goalId: GOAL,
      request: tokyo!,
      result: { learnerRevision: "9", moved: true },
    });

    // Kiritimati's ask is still out; Tokyo's waits for its revision.
    expect(
      follows.begin({ deviceZone: DEVICE, goalId: GOAL, summary: summaryOf() }),
    ).toBeUndefined();

    expect(
      follows.begin({
        deviceZone: "Asia/Tokyo",
        goalId: GOAL,
        summary: summaryOf({ revision: "9" }),
      }),
    ).toBeDefined();

    // A failed ask lets the next summary ask again.
    follows.settle({ goalId: GOAL, request: kiritimati!, result: null });
    expect(follows.begin({ deviceZone: DEVICE, goalId: GOAL, summary: summaryOf() })).toBeDefined();
  });
});

describe("settling a follow when its ask answers", () => {
  it("waits for the move's revision, or for the moment the day may move", () => {
    const request = sentOf({ inFlight: true });

    expect(
      settleTimeZoneFollow({
        held: request,
        request,
        result: { learnerRevision: "5", moved: true },
      }),
    ).toStrictEqual(sentOf({ learnerRevision: "5" }));

    expect(
      settleTimeZoneFollow({ held: request, request, result: { moved: false, retryAt: 900 } }),
    ).toStrictEqual(sentOf({ readAt: 900 }));
  });

  it("lets the next summary ask again after a failed ask", () => {
    const request = sentOf({ inFlight: true });

    expect(settleTimeZoneFollow({ held: request, request, result: null })).toBeUndefined();
  });

  it("leaves a newer ask alone when an older zone's answer arrives late", () => {
    const older = sentOf({ inFlight: true }, { request: 1, timeZone: "Asia/Tokyo" });
    const newer = sentOf({ inFlight: true }, { request: 2 });

    expect(
      settleTimeZoneFollow({
        held: newer,
        request: older,
        result: { learnerRevision: "9", moved: true },
      }),
    ).toBe(newer);

    expect(settleTimeZoneFollow({ held: newer, request: older, result: null })).toBe(newer);
  });
});
