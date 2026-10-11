import { randomUUID } from "node:crypto";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getNoticeDay, loadNoticeDates } from "./notice-day";

const citation = { passage: "", sourceId: "notice" };
const TODAY = "2026-10-08";

/** A stored public notice whose edition has these exam days. */
function notice({ days, year }: { days: string[]; year: number }) {
  return {
    edition: {
      citations: [],
      dates: days.map((date) => ({ citation, date, kind: "exam", label: "Exam", startTime: null })),
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      timeZone: null,
      year,
    },
    ownerId: null,
  };
}

const OAB = notice({ days: ["2027-01-10"], year: 2026 });

describe(getNoticeDay, () => {
  it("offers the notice's official day over any other date, the learner's own too", () => {
    const base = { blueprint: OAB, details: {}, noticeDate: null, today: TODAY };

    // Her month (March) kept over the notice's January day, and a day of her own.
    expect(getNoticeDay({ ...base, goalDate: "2027-03-01" })).toStrictEqual({
      date: "2027-01-10",
      estimated: false,
    });

    expect(getNoticeDay({ ...base, goalDate: "2027-02-20" })).toStrictEqual({
      date: "2027-01-10",
      estimated: false,
    });
  });

  it("never offers a day the learner kept their own date over", () => {
    const base = { blueprint: OAB, details: {}, goalDate: "2027-02-20", noticeDate: null };

    expect(getNoticeDay({ ...base, kept: ["2027-01-10"], today: TODAY })).toBeNull();

    // The understanding card offered it next to her month, and she kept her month.
    expect(
      getNoticeDay({ ...base, details: { offeredNoticeDay: "2027-01-10" }, today: TODAY }),
    ).toBeNull();
  });

  it("offers nothing when the plan already counts down to the notice's day", () => {
    expect(
      getNoticeDay({
        blueprint: OAB,
        details: {},
        goalDate: "2027-01-10",
        noticeDate: "2027-01-10",
        today: TODAY,
      }),
    ).toBeNull();
  });

  it("offers an estimated day only for a date the plan took from the notice", () => {
    // ENEM 2028 has no notice yet: its days are estimated from 2026's.
    const enem = notice({ days: ["2026-11-08", "2026-11-15"], year: 2026 });
    const base = { blueprint: enem, details: { examYear: 2028 }, today: TODAY };

    expect(getNoticeDay({ ...base, goalDate: "2028-12-01", noticeDate: null })).toBeNull();

    expect(
      getNoticeDay({ ...base, goalDate: "2028-11-01", noticeDate: "2028-11-01" }),
    ).toStrictEqual({ date: "2028-11-12", estimated: true });
  });

  it("never offers a day from a class test's own material, nor from no notice", () => {
    const material = { ...notice({ days: ["2026-10-10"], year: 2026 }), ownerId: "learner" };
    const base = { details: {}, goalDate: "2026-10-09", noticeDate: null, today: TODAY };

    expect(getNoticeDay({ ...base, blueprint: material })).toBeNull();
    expect(getNoticeDay({ ...base, blueprint: null })).toBeNull();
  });

  // DELE B2's calendar lists a sitting every month or two. A learner who said "four months" (10
  // February) was offered 16 October, six days away.
  it("offers the sitting in the learner's month when the notice lists several, or none", () => {
    const dele = notice({
      days: ["2026-10-16", "2026-11-14", "2027-04-02", "2027-05-22", "2027-07-09"],
      year: 2026,
    });

    const base = { blueprint: dele, details: {}, noticeDate: null, today: TODAY };

    expect(getNoticeDay({ ...base, goalDate: "2027-02-10" })).toBeNull();

    expect(getNoticeDay({ ...base, goalDate: "2027-05-30" })).toStrictEqual({
      date: "2027-05-22",
      estimated: false,
    });

    // A date the plan took from the notice follows its sitting when the notice corrects it.
    expect(
      getNoticeDay({ ...base, goalDate: "2027-04-01", noticeDate: "2027-04-01" }),
    ).toStrictEqual({ date: "2027-04-02", estimated: false });

    // Without a date of their own, or once theirs passed, the next sitting.
    expect(getNoticeDay({ ...base, goalDate: null })).toStrictEqual({
      date: "2026-10-16",
      estimated: false,
    });
  });

  it("offers nothing once the notice's days have passed", () => {
    const past = notice({ days: ["2026-09-20"], year: 2026 });

    expect(
      getNoticeDay({
        blueprint: past,
        details: { examYear: 2026 },
        goalDate: "2026-12-01",
        noticeDate: null,
        today: TODAY,
      }),
    ).toBeNull();
  });
});

describe("the next sitting after the goal's", () => {
  const dele = notice({
    days: ["2026-10-16", "2026-11-14", "2027-04-02", "2027-05-22", "2027-07-09"],
    year: 2026,
  });

  async function loadNextSitting({
    blueprint,
    goalDate,
    today = TODAY,
  }: {
    blueprint: Omit<ReturnType<typeof notice>, "ownerId"> & { ownerId: string | null };
    goalDate: string | null;
    today?: string;
  }) {
    const stored = await examBlueprintFixture(blueprint);

    const dates = await loadNoticeDates({
      goal: { details: {}, examBlueprintId: stored.id, id: randomUUID(), kind: "exam" },
      goalDate,
      noticeDate: null,
      today,
    });

    return dates.nextSitting;
  }

  it("gives the first day of the sitting after the goal's, when the notice lists it", async () => {
    await expect(loadNextSitting({ blueprint: dele, goalDate: "2027-04-02" })).resolves.toBe(
      "2027-05-22",
    );

    // Once the goal's sitting passed, the next one from today.
    await expect(
      loadNextSitting({ blueprint: dele, goalDate: "2026-10-16", today: "2026-11-20" }),
    ).resolves.toBe("2027-04-02");
  });

  it("gives none for an edition whose notice isn't out, so the date is never a guess", async () => {
    // ENEM 2026 takes two Sundays; ENEM 2027's days are only estimated.
    const enem = notice({ days: ["2026-11-08", "2026-11-15"], year: 2026 });

    await expect(loadNextSitting({ blueprint: enem, goalDate: "2026-11-08" })).resolves.toBeNull();
  });

  it("gives none for a class test's own material or a goal without a date", async () => {
    const user = await userFixture();
    const material = { ...dele, ownerId: user.id };

    await expect(
      loadNextSitting({ blueprint: material, goalDate: "2027-04-02" }),
    ).resolves.toBeNull();

    await expect(loadNextSitting({ blueprint: dele, goalDate: null })).resolves.toBeNull();
  });
});
