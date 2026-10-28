import { describe, expect, it } from "vitest";
import {
  type TabMissionsReport,
  type TabMissionsReports,
  type TabMissionsScope,
  addTabMissionsReport,
  findTabMissionsReport,
  toStudyDayDate,
} from "./tab-missions";

const TODAY = "2026-10-14";
const YESTERDAY = "2026-10-13";

function reportFor(
  userId: string,
  readAt: number,
  done: number,
  day: { goalId?: string; localDate?: string } = {},
): TabMissionsReport {
  return {
    day: { goalId: day.goalId ?? "goal-a", localDate: day.localDate ?? TODAY },
    missions: { done, total: 3 },
    readAt,
    userId,
  };
}

function scopeOf(
  learnerId: string,
  day: { goalId?: string; localDate?: string } = {},
): TabMissionsScope {
  return { day: { goalId: day.goalId ?? "goal-a", localDate: day.localDate ?? TODAY }, learnerId };
}

function addAll(reads: TabMissionsReport[]): TabMissionsReports {
  return reads.reduce<TabMissionsReports>(
    (current, read) => addTabMissionsReport(current, read),
    {},
  );
}

describe("the buddy tab's missions from page reads", () => {
  it("shows only a read made for the learner the frame holds", () => {
    const reports = addTabMissionsReport({}, reportFor("first", 10, 1));

    expect(findTabMissionsReport({ reports, scope: scopeOf("first") })).toMatchObject({
      userId: "first",
    });

    expect(findTabMissionsReport({ reports, scope: scopeOf("second") })).toBeNull();
    expect(findTabMissionsReport({ reports, scope: null })).toBeNull();
  });

  it("keeps the held learner's read when another account's read arrives late", () => {
    const reports = addAll([reportFor("second", 20, 2), reportFor("first", 30, 1)]);

    expect(findTabMissionsReport({ reports, scope: scopeOf("second") })).toStrictEqual(
      reportFor("second", 20, 2),
    );
  });

  it("never lets an older read of the same day replace a newer one", () => {
    const reports = addAll([reportFor("first", 30, 2), reportFor("first", 20, 1)]);

    expect(findTabMissionsReport({ reports, scope: scopeOf("first") })).toStrictEqual(
      reportFor("first", 30, 2),
    );
  });

  it("never shows a read of another goal, even one that arrives later", () => {
    const goalB = reportFor("first", 20, 1, { goalId: "goal-b" });
    const reports = addAll([goalB, reportFor("first", 30, 3)]);

    expect(
      findTabMissionsReport({ reports, scope: scopeOf("first", { goalId: "goal-b" }) }),
    ).toStrictEqual(goalB);

    expect(
      findTabMissionsReport({ reports, scope: scopeOf("first", { goalId: "goal-c" }) }),
    ).toBeNull();
  });

  it("never shows yesterday's missions in today's frame, even stamped after midnight", () => {
    const reports = addAll([reportFor("first", 50, 2, { localDate: YESTERDAY })]);

    expect(findTabMissionsReport({ reports, scope: scopeOf("first") })).toBeNull();

    expect(
      findTabMissionsReport({ reports, scope: scopeOf("first", { localDate: YESTERDAY }) }),
    ).toMatchObject({ missions: { done: 2 } });
  });

  it("names a session's day as the summary does", () => {
    expect(toStudyDayDate(new Date("2026-10-14T00:00:00.000Z"))).toBe(TODAY);
  });
});
