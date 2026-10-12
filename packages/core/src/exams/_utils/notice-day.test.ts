import { randomUUID } from "node:crypto";
import { type Goal } from "@zoonk/db";
import { goalFixture, planChangeFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { toPlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { NOTICE_SOURCE } from "../../plans/plan-change-contract";
import { loadNoticeDates, loadNoticeDay } from "./notice-day";

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

type NoticeBlueprint = Omit<ReturnType<typeof notice>, "ownerId"> & { ownerId: string | null };

/** The notice's day for an exam goal on this notice, as the plan and Today read it. */
async function loadDay({
  blueprint,
  details = {},
  goalDate,
  noticeDate = null,
  today = TODAY,
}: {
  blueprint: NoticeBlueprint | null;
  details?: Goal["details"];
  goalDate: string | null;
  noticeDate?: string | null;
  today?: string;
}) {
  const stored = blueprint ? await examBlueprintFixture(blueprint) : null;

  return loadNoticeDay({
    goal: { details, examBlueprintId: stored?.id ?? null, id: randomUUID(), kind: "exam" },
    goalDate,
    noticeDate,
    today,
  });
}

describe(loadNoticeDay, () => {
  it("offers the notice's official day over any other date, the learner's own too", async () => {
    // Her month (March) kept over the notice's January day, and a day of her own.
    await expect(loadDay({ blueprint: OAB, goalDate: "2027-03-01" })).resolves.toStrictEqual({
      date: "2027-01-10",
      estimated: false,
    });

    await expect(loadDay({ blueprint: OAB, goalDate: "2027-02-20" })).resolves.toStrictEqual({
      date: "2027-01-10",
      estimated: false,
    });
  });

  it("never offers a day the learner kept their own date over", async () => {
    const [user, blueprint] = await Promise.all([userFixture(), examBlueprintFixture(OAB)]);

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    const plan = await planFixture({ goalId: goal.id });

    // "Keep mine" on Today's offer of the notice's day.
    await planChangeFixture({
      kind: "edited",
      payload: toPlanChangePayload({
        operations: [{ estimated: false, kind: "setNoticeDate", targetDate: "2027-01-10" }],
        source: NOTICE_SOURCE,
      }),
      planId: plan.id,
      status: "declined",
    });

    const request = { goalDate: "2027-02-20", noticeDate: null, today: TODAY };

    await expect(
      loadNoticeDay({
        ...request,
        goal: { details: {}, examBlueprintId: blueprint.id, id: goal.id, kind: "exam" },
      }),
    ).resolves.toBeNull();

    // The understanding card offered it next to her month, and she kept her month.
    await expect(
      loadDay({
        blueprint: OAB,
        details: { offeredNoticeDay: "2027-01-10" },
        goalDate: request.goalDate,
      }),
    ).resolves.toBeNull();
  });

  it("offers nothing when the plan already counts down to the notice's day", async () => {
    await expect(
      loadDay({ blueprint: OAB, goalDate: "2027-01-10", noticeDate: "2027-01-10" }),
    ).resolves.toBeNull();
  });

  it("offers an estimated day only for a date the plan took from the notice", async () => {
    // ENEM 2028 has no notice yet: its days are estimated from 2026's.
    const enem = notice({ days: ["2026-11-08", "2026-11-15"], year: 2026 });
    const base = { blueprint: enem, details: { examYear: 2028 } };

    await expect(
      loadDay({ ...base, goalDate: "2028-12-01", noticeDate: null }),
    ).resolves.toBeNull();

    await expect(
      loadDay({ ...base, goalDate: "2028-11-01", noticeDate: "2028-11-01" }),
    ).resolves.toStrictEqual({ date: "2028-11-12", estimated: true });
  });

  it("never offers a day from a class test's own material, nor from no notice", async () => {
    const user = await userFixture();
    const material = { ...notice({ days: ["2026-10-10"], year: 2026 }), ownerId: user.id };

    await expect(loadDay({ blueprint: material, goalDate: "2026-10-09" })).resolves.toBeNull();
    await expect(loadDay({ blueprint: null, goalDate: "2026-10-09" })).resolves.toBeNull();
  });

  // DELE B2's calendar lists a sitting every month or two. A learner who said "four months" (10
  // February) was offered 16 October, six days away.
  it("offers the sitting in the learner's month when the notice lists several, or none", async () => {
    const dele = notice({
      days: ["2026-10-16", "2026-11-14", "2027-04-02", "2027-05-22", "2027-07-09"],
      year: 2026,
    });

    await expect(loadDay({ blueprint: dele, goalDate: "2027-02-10" })).resolves.toBeNull();

    await expect(loadDay({ blueprint: dele, goalDate: "2027-05-30" })).resolves.toStrictEqual({
      date: "2027-05-22",
      estimated: false,
    });

    // A date the plan took from the notice follows its sitting when the notice corrects it.
    await expect(
      loadDay({ blueprint: dele, goalDate: "2027-04-01", noticeDate: "2027-04-01" }),
    ).resolves.toStrictEqual({ date: "2027-04-02", estimated: false });

    // Without a date of their own, or once theirs passed, the next sitting.
    await expect(loadDay({ blueprint: dele, goalDate: null })).resolves.toStrictEqual({
      date: "2026-10-16",
      estimated: false,
    });
  });

  it("offers nothing once the notice's days have passed", async () => {
    const past = notice({ days: ["2026-09-20"], year: 2026 });

    await expect(
      loadDay({ blueprint: past, details: { examYear: 2026 }, goalDate: "2026-12-01" }),
    ).resolves.toBeNull();
  });
});

/** The first day of the sitting after the goal's, for an exam goal on this notice. */
async function loadNextSitting({
  blueprint,
  goalDate,
  today = TODAY,
}: {
  blueprint: NoticeBlueprint;
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

describe("the next sitting after the goal's", () => {
  const dele = notice({
    days: ["2026-10-16", "2026-11-14", "2027-04-02", "2027-05-22", "2027-07-09"],
    year: 2026,
  });

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
