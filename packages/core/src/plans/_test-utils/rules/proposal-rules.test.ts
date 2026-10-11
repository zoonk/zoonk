import { describe, expect, it } from "vitest";
import { checkDeclinedNotReoffered } from "./proposal-rules";
import { ruleChange, ruleContext, rulePlan } from "./rule-fixtures";

const after = rulePlan({ skills: [] });

function noticeDay(targetDate: string, status: "declined" | "proposed") {
  return ruleChange({
    effect: {},
    id: `${status}-${targetDate}`,
    operations: [{ estimated: false, kind: "setNoticeDate", targetDate }],
    source: "notice",
    status,
  });
}

describe("R33 a declined proposal isn't offered again until something new happens", () => {
  it("passes when the notice brings a new day", () => {
    const context = ruleContext({
      after,
      changes: [noticeDay("2027-03-14", "proposed")],
      declined: [noticeDay("2027-03-07", "declined")],
    });

    expect(checkDeclinedNotReoffered(context)).toStrictEqual([]);
  });

  it("flags the same day offered again after the learner kept theirs (Sofia)", () => {
    const declined = { ...noticeDay("2027-03-07", "declined"), id: "first" };

    const context = ruleContext({
      after,
      changes: [noticeDay("2027-03-07", "proposed")],
      declined: [declined],
    });

    expect(checkDeclinedNotReoffered(context)).toMatchObject([
      { details: { kind: "edited" }, rule: "R33" },
    ]);
  });

  it("passes when a new edition offers the declined notice change again", () => {
    const context = ruleContext({
      after,
      changes: [noticeDay("2027-03-07", "proposed")],
      declined: [noticeDay("2027-03-07", "declined")],
      event: { changesPlan: true, kind: "noticeEdition" },
    });

    expect(checkDeclinedNotReoffered(context)).toStrictEqual([]);
  });

  it("flags a new edition that changes the plan and isn't offered after a decline", () => {
    const context = ruleContext({
      after,
      declined: [noticeDay("2027-03-07", "declined")],
      event: { changesPlan: true, kind: "noticeEdition" },
    });

    expect(checkDeclinedNotReoffered(context)).toMatchObject([
      { details: { declined: 1 }, rule: "R33" },
    ]);
  });
});
