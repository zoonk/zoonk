import { describe, expect, it } from "vitest";
import { type ExamEdition } from "../../library/exams/blueprint-contract";
import { getExamEditionDays, readExamYear } from "./exam-edition-days";

const citation = { passage: "", sourceId: "notice" };

function edition({
  days,
  year,
}: {
  days: { date: string; label?: string; startTime?: string }[];
  year: number | null;
}): ExamEdition {
  return {
    citations: [],
    dates: [
      {
        citation,
        date: "2026-05-20",
        kind: "registrationEnd",
        label: "Registration closes",
        startTime: null,
      },
      ...days.map((day) => ({
        citation,
        date: day.date,
        kind: "exam" as const,
        label: day.label ?? "Exam",
        startTime: day.startTime ?? null,
      })),
    ],
    noticeUrl: null,
    questionCount: null,
    sourceHash: null,
    timeZone: "America/Sao_Paulo",
    year,
  };
}

/** ENEM 2026: the second and third Sundays of November. */
const ENEM_2026 = edition({
  days: [
    { date: "2026-11-15", label: "Enem 2026, day 2", startTime: "13:30" },
    { date: "2026-11-08", label: "Enem 2026, day 1", startTime: "13:30" },
  ],
  year: 2026,
});

function datesOf(result: ReturnType<typeof getExamEditionDays>) {
  return result.days.map((day) => day.date);
}

describe(getExamEditionDays, () => {
  it("uses the notice's own days for the year it was published for", () => {
    const result = getExamEditionDays({ edition: ENEM_2026, examYear: 2026, from: "2026-09-28" });

    expect(result).toMatchObject({ estimated: false });

    expect(result.days.map((day) => [day.date, day.label])).toStrictEqual([
      ["2026-11-08", "Enem 2026, day 1"],
      ["2026-11-15", "Enem 2026, day 2"],
    ]);
  });

  it("estimates another year from the same week and weekday, keeping labels and start times", () => {
    const result = getExamEditionDays({ edition: ENEM_2026, examYear: 2028, from: "2026-09-28" });

    expect(result.estimated).toBe(true);

    expect(result.days.map((day) => [day.date, day.label, day.startTime])).toStrictEqual([
      ["2028-11-12", "Enem 2028, day 1", "13:30"],
      ["2028-11-19", "Enem 2028, day 2", "13:30"],
    ]);
  });

  it("reads the edition's year from its days when the notice doesn't state it", () => {
    const undated = edition({ days: [{ date: "2026-11-08" }], year: null });

    expect(
      getExamEditionDays({ edition: undated, examYear: 2026, from: "2026-09-28" }),
    ).toMatchObject({ estimated: false });

    expect(
      datesOf(getExamEditionDays({ edition: undated, examYear: 2027, from: "2026-09-28" })),
    ).toStrictEqual(["2027-11-14"]);
  });

  it("keeps the days of one sitting together, even across a month's weeks", () => {
    // A Saturday and Sunday exam: the Sunday is the first of March, but it moves with its Saturday.
    const weekend = edition({ days: [{ date: "2026-02-28" }, { date: "2026-03-01" }], year: 2026 });

    expect(
      datesOf(getExamEditionDays({ edition: weekend, examYear: 2027, from: "2026-01-01" })),
    ).toStrictEqual(["2027-02-27", "2027-02-28"]);
  });

  it("moves each sitting of a multi-sitting exam on its own", () => {
    // The SAT's August and October dates: the fourth Saturday of August, the first of October.
    const sat = edition({ days: [{ date: "2026-08-22" }, { date: "2026-10-03" }], year: 2026 });

    expect(
      datesOf(getExamEditionDays({ edition: sat, examYear: 2027, from: "2026-01-01" })),
    ).toStrictEqual(["2027-08-28", "2027-10-02"]);
  });

  it("falls back to the month's last weekday when it has no fifth one", () => {
    const lastMonday = edition({ days: [{ date: "2026-08-31" }], year: 2026 });

    expect(
      datesOf(getExamEditionDays({ edition: lastMonday, examYear: 2028, from: "2026-01-01" })),
    ).toStrictEqual(["2028-08-28"]);
  });

  it("keeps the notice's edition without a year while any of its days is still ahead", () => {
    const sat = edition({ days: [{ date: "2026-03-14" }, { date: "2026-10-03" }], year: 2026 });

    expect(getExamEditionDays({ edition: sat, examYear: null, from: "2026-09-28" })).toMatchObject({
      estimated: false,
    });

    expect(
      datesOf(getExamEditionDays({ edition: sat, examYear: null, from: "2026-09-28" })),
    ).toStrictEqual(["2026-03-14", "2026-10-03"]);
  });

  it("estimates the next edition without a year once every day has passed", () => {
    const afterExam = getExamEditionDays({
      edition: ENEM_2026,
      examYear: null,
      from: "2026-12-01",
    });

    expect(afterExam.estimated).toBe(true);
    expect(datesOf(afterExam)).toStrictEqual(["2027-11-14", "2027-11-21"]);

    // A notice from two years back skips the edition that has passed as well.
    const enem2024 = edition({
      days: [{ date: "2024-11-03" }, { date: "2024-11-10" }],
      year: 2024,
    });

    expect(
      datesOf(getExamEditionDays({ edition: enem2024, examYear: null, from: "2026-09-28" })),
    ).toStrictEqual(["2026-11-01", "2026-11-08"]);
  });

  it("has no days for an exam whose notice has none", () => {
    const noExamDays = edition({ days: [], year: 2026 });

    expect(
      getExamEditionDays({ edition: noExamDays, examYear: 2028, from: "2026-09-28" }),
    ).toStrictEqual({ days: [], estimated: false });

    expect(getExamEditionDays({ edition: null, examYear: null, from: "2026-09-28" })).toStrictEqual(
      { days: [], estimated: false },
    );
  });
});

describe(readExamYear, () => {
  it("reads the year the learner named from the goal's details", () => {
    expect(readExamYear({ examName: "ENEM", examYear: 2028 })).toBe(2028);
    expect(readExamYear({ examName: "ENEM" })).toBeNull();
    expect(readExamYear({ examYear: "2028" })).toBeNull();
    expect(readExamYear(null)).toBeNull();
  });
});
