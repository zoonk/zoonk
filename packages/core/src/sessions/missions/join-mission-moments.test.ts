import { describe, expect, it } from "vitest";
import { type MissionMomentView } from "../completion-contract";
import { joinMissionMoments } from "./join-mission-moments";

const CALL_DONE = { done: 1, kind: "call", status: "done", total: 1 } as const;
const MOCK_DONE = { done: 1, kind: "mock", status: "done", total: 1 } as const;
const REVIEW_LEFT = { done: 0, kind: "review", status: "todo", total: 1 } as const;
const REVIEW_DONE = { ...REVIEW_LEFT, done: 1, status: "done" } as const;

function moment(overrides: Partial<MissionMomentView>): MissionMomentView {
  return {
    completed: [],
    fullMeal: { bonus: 50, paid: false },
    missions: [CALL_DONE, REVIEW_LEFT],
    ...overrides,
  };
}

describe(joinMissionMoments, () => {
  it("is nothing when no activity completed a mission", () => {
    expect(joinMissionMoments([null, null])).toBeNull();
  });

  it("joins every mission completed, and the day as the paying activity left it", () => {
    const paying = moment({
      completed: ["mock"],
      fullMeal: { bonus: 50, paid: true },
      missions: [CALL_DONE, MOCK_DONE, REVIEW_DONE],
    });

    expect(joinMissionMoments([moment({ completed: ["call"] }), null, paying])).toStrictEqual({
      completed: ["call", "mock"],
      fullMeal: { bonus: 50, paid: true },
      missions: [CALL_DONE, MOCK_DONE, REVIEW_DONE],
    });
  });

  it("keeps the paying activity's day even when a later one completed nothing new", () => {
    const paying = moment({
      completed: ["call"],
      fullMeal: { bonus: 50, paid: true },
      missions: [CALL_DONE, REVIEW_DONE],
    });

    expect(joinMissionMoments([paying, moment({ completed: ["call"] })])).toStrictEqual(paying);
  });

  it("leaves the day as the last activity left it when none paid the bonus", () => {
    const last = moment({ completed: ["call"], missions: [CALL_DONE] });

    expect(joinMissionMoments([moment({ completed: ["call"] }), last])).toStrictEqual(last);
  });
});
