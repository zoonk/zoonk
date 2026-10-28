import { describe, expect, it } from "vitest";
import { findClosestSittings, findLearnerSitting, listOpenSittings } from "./exam-sittings";

describe(findLearnerSitting, () => {
  const dele = ["2026-05-23", "2026-10-16", "2026-11-14", "2027-04-02", "2027-05-22"].map(
    (date) => ({ date }),
  );

  const enem = [{ date: "2026-11-08" }, { date: "2026-11-15" }];

  function sittingOf(goalDate: string | null, days = dele, from = "2026-10-11") {
    return findLearnerSitting({ days, from, goalDate })?.map((day) => day.date) ?? null;
  }

  it("picks the sitting in the month of the learner's date among several", () => {
    expect(sittingOf("2027-04-20")).toStrictEqual(["2027-04-02"]);
    expect(sittingOf("2026-11-01")).toStrictEqual(["2026-11-14"]);
  });

  it("picks none when the learner's month has no sitting, rather than another month's", () => {
    expect(sittingOf("2027-02-10")).toBeNull();
    expect(sittingOf("2026-05-30")).toBeNull();
  });

  it("picks the next sitting without a date of the learner's", () => {
    expect(sittingOf(null)).toStrictEqual(["2026-10-16"]);
  });

  it("picks the next sitting still open for registration without a date of the learner's", () => {
    const closed = new Set(["2026-10-16", "2026-11-14"]);
    const days = dele.map((day) => ({ ...day, registrationClosed: closed.has(day.date) }));

    expect(sittingOf(null, days)).toStrictEqual(["2027-04-02"]);

    const allClosed = dele.map((day) => ({ ...day, registrationClosed: true }));
    expect(sittingOf(null, allClosed)).toStrictEqual(["2026-10-16"]);

    const enemClosed = enem.map((day) => ({ ...day, registrationClosed: true }));
    expect(sittingOf(null, enemClosed)).toStrictEqual(["2026-11-08", "2026-11-15"]);
  });

  it("picks an exam's one sitting, its every day, whatever date the learner gave", () => {
    expect(sittingOf("2027-02-10", enem, "2026-10-11")).toStrictEqual(["2026-11-08", "2026-11-15"]);

    expect(sittingOf(null, enem, "2026-11-10")).toStrictEqual(["2026-11-08", "2026-11-15"]);
    expect(sittingOf(null, enem, "2026-11-16")).toBeNull();
  });
});

describe(listOpenSittings, () => {
  const days = [
    { date: "2026-10-16", registrationClosed: true },
    { date: "2026-11-14", registrationClosed: true },
    { date: "2027-04-02", registrationClosed: false },
    { date: "2027-05-22", registrationClosed: false },
    { date: "2027-07-09", registrationClosed: false },
    { date: "2027-10-15", registrationClosed: false },
  ];

  it("lists the first day of the next sittings still open for registration", () => {
    const open = listOpenSittings({ count: 3, days, from: "2026-10-11" });

    expect(open.map((day) => day.date)).toStrictEqual(["2027-04-02", "2027-05-22", "2027-07-09"]);
  });

  it("leaves out sittings before `from`, and lists fewer when fewer are left", () => {
    const open = listOpenSittings({ count: 3, days, from: "2027-06-01" });
    expect(open.map((day) => day.date)).toStrictEqual(["2027-07-09", "2027-10-15"]);
  });

  it("lists a sitting of several days once, by its first day", () => {
    const weekends = [
      { date: "2027-04-03" },
      { date: "2027-04-04" },
      { date: "2027-06-05" },
      { date: "2027-06-06" },
    ];

    const open = listOpenSittings({ count: 3, days: weekends, from: "2027-01-01" });
    expect(open.map((day) => day.date)).toStrictEqual(["2027-04-03", "2027-06-05"]);
  });
});

describe(findClosestSittings, () => {
  const days = [
    { date: "2026-10-16", registrationClosed: true },
    { date: "2026-11-14", registrationClosed: false },
    { date: "2027-04-02", registrationClosed: false },
    { date: "2027-05-22", registrationClosed: false },
  ];

  function closestTo(goalDate: string, from = "2026-10-11", list = days) {
    return findClosestSittings({ days: list, from, goalDate }).map((day) => day.date);
  }

  it("gives the closest sitting before the learner's month and the closest after it", () => {
    expect(closestTo("2027-02-10")).toStrictEqual(["2026-11-14", "2027-04-02"]);
  });

  it("leaves out sittings closed for registration and sittings before `from`", () => {
    const novemberClosed = days.map((day) => ({
      ...day,
      registrationClosed: day.registrationClosed || day.date === "2026-11-14",
    }));

    expect(closestTo("2027-02-10", "2026-10-11", novemberClosed)).toStrictEqual(["2027-04-02"]);
    expect(closestTo("2027-02-10", "2026-11-20")).toStrictEqual(["2027-04-02"]);
  });

  it("gives only the one side that has a sitting", () => {
    expect(closestTo("2027-08-10")).toStrictEqual(["2027-05-22"]);
  });
});
