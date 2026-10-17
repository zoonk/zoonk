import { describe, expect, it } from "vitest";
import { getNextExamCheck, getNextSourceCheck, getSourceValidUntil } from "./freshness-schedule";

const NOW = new Date("2026-09-26T12:00:00.000Z");
const NO_DATES = { examDate: null, registrationEndsAt: null, registrationStartsAt: null };

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 86_400_000);
}

describe(getNextExamCheck, () => {
  it("checks daily while registration is open", () => {
    const schedule = getNextExamCheck({
      dates: { ...NO_DATES, examDate: daysFromNow(60), registrationEndsAt: daysFromNow(5) },
      now: NOW,
    });

    expect(schedule).toStrictEqual({ nextCheckAt: daysFromNow(1), stop: null });
  });

  it("checks daily in the last 14 days before the exam", () => {
    const schedule = getNextExamCheck({
      dates: { ...NO_DATES, examDate: daysFromNow(10) },
      now: NOW,
    });

    expect(schedule.nextCheckAt).toStrictEqual(daysFromNow(1));
  });

  it("checks weekly otherwise", () => {
    const schedule = getNextExamCheck({
      dates: { ...NO_DATES, examDate: daysFromNow(120), registrationEndsAt: daysFromNow(-20) },
      now: NOW,
    });

    expect(schedule.nextCheckAt).toStrictEqual(daysFromNow(7));
  });

  it("wakes up on the day registration opens instead of a week later", () => {
    const schedule = getNextExamCheck({
      dates: {
        examDate: daysFromNow(120),
        registrationEndsAt: daysFromNow(30),
        registrationStartsAt: daysFromNow(3),
      },
      now: NOW,
    });

    expect(schedule.nextCheckAt).toStrictEqual(daysFromNow(3));
  });

  it("wakes up when the final stretch starts", () => {
    const schedule = getNextExamCheck({
      dates: { ...NO_DATES, examDate: daysFromNow(18) },
      now: NOW,
    });

    expect(schedule.nextCheckAt).toStrictEqual(daysFromNow(4));
  });

  it("keeps checking on exam day and stops once the exam has passed", () => {
    expect(getNextExamCheck({ dates: { ...NO_DATES, examDate: NOW }, now: NOW }).stop).toBeNull();

    expect(
      getNextExamCheck({ dates: { ...NO_DATES, examDate: daysFromNow(-2) }, now: NOW }),
    ).toStrictEqual({ nextCheckAt: null, stop: "examPassed" });
  });

  it("checks weekly when no date is known yet", () => {
    expect(getNextExamCheck({ dates: NO_DATES, now: NOW }).nextCheckAt).toStrictEqual(
      daysFromNow(7),
    );
  });
});

describe(getNextSourceCheck, () => {
  it("wakes up when the source stops being valid", () => {
    expect(getNextSourceCheck({ now: NOW, validUntil: daysFromNow(30) })).toStrictEqual(
      daysFromNow(30),
    );
  });

  it("checks tomorrow when the source is already stale", () => {
    expect(getNextSourceCheck({ now: NOW, validUntil: daysFromNow(-3) })).toStrictEqual(
      daysFromNow(1),
    );
  });
});

describe(getSourceValidUntil, () => {
  it("keeps laws and undated exam notices 30 days, software 90 days and reference syllabi a year", () => {
    expect(getSourceValidUntil({ fetchedAt: NOW, topic: "exam" })).toStrictEqual(daysFromNow(30));

    expect(getSourceValidUntil({ fetchedAt: NOW, topic: "regulation" })).toStrictEqual(
      daysFromNow(30),
    );

    expect(getSourceValidUntil({ fetchedAt: NOW, topic: "software" })).toStrictEqual(
      daysFromNow(90),
    );

    expect(getSourceValidUntil({ fetchedAt: NOW, topic: "syllabus" })).toStrictEqual(
      daysFromNow(365),
    );
  });
});
