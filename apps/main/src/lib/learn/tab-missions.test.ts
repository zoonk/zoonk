import { describe, expect, it } from "vitest";
import {
  type TabMissionsReport,
  type TabMissionsReports,
  addTabMissionsReport,
  findTabMissionsReport,
} from "./tab-missions";

function reportFor(userId: string, readAt: number, done: number): TabMissionsReport {
  return { missions: { done, total: 3 }, readAt, userId };
}

describe("the buddy tab's missions from page reads", () => {
  it("shows only a read made for the learner the frame holds", () => {
    const reports = addTabMissionsReport({}, reportFor("first", 10, 1));

    expect(findTabMissionsReport({ learnerId: "first", reports })).toMatchObject({
      userId: "first",
    });

    expect(findTabMissionsReport({ learnerId: "second", reports })).toBeNull();
    expect(findTabMissionsReport({ learnerId: null, reports })).toBeNull();
  });

  it("keeps the held learner's read when another account's read arrives late", () => {
    const reports = [
      reportFor("second", 20, 2),
      reportFor("first", 30, 1),
    ].reduce<TabMissionsReports>((current, read) => addTabMissionsReport(current, read), {});

    expect(findTabMissionsReport({ learnerId: "second", reports })).toStrictEqual(
      reportFor("second", 20, 2),
    );
  });

  it("never lets an older read of the same learner replace a newer one", () => {
    const reports = [
      reportFor("first", 30, 2),
      reportFor("first", 20, 1),
    ].reduce<TabMissionsReports>((current, read) => addTabMissionsReport(current, read), {});

    expect(findTabMissionsReport({ learnerId: "first", reports })).toStrictEqual(
      reportFor("first", 30, 2),
    );
  });
});
