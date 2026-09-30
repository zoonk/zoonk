import { randomUUID } from "node:crypto";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import { buildExamIdentityKey } from "../../../library/exams/exam-identity";
import { findExamFacts } from "./exam-facts";

const TODAY = "2026-09-28";

/** A stored notice for a new exam, with its exam days read from an official page. */
async function storedExam({ days, year }: { days: string[]; year: number }) {
  const examName = `Test Exam ${randomUUID()}`;
  const source = await sourceFixture({ title: "Official notice" });
  const citation = { passage: "The exam takes place on", sourceId: source.id };

  const blueprint = await examBlueprintFixture({
    edition: {
      citations: [],
      dates: [
        { citation, date: `${year}-05-20`, kind: "registrationEnd", label: "Registration ends" },
        ...days.map((date, index) => ({
          citation,
          date,
          kind: "exam" as const,
          label: `Day ${index + 1}`,
        })),
      ],
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      year,
    },
    identityKey: buildExamIdentityKey({ name: examName, ownerId: null, role: null }),
    name: examName,
  });

  return { blueprint, examName, source };
}

describe(findExamFacts, () => {
  it("gives the notice's days still ahead, with their source, for the year it's for", async () => {
    const { blueprint, examName, source } = await storedExam({
      days: ["2026-03-01", "2026-11-08", "2026-11-15"],
      year: 2026,
    });

    const officialSource = { title: "Official notice", url: source.url };

    const expected = {
      blueprintId: blueprint.id,
      dates: [
        { date: "2026-11-08", estimated: false, label: "Day 2", source: officialSource },
        { date: "2026-11-15", estimated: false, label: "Day 3", source: officialSource },
      ],
    };

    const [named, unnamed] = await Promise.all([
      findExamFacts({ examName, examYear: 2026, language: "en", today: TODAY }),
      findExamFacts({ examName, language: "en", today: TODAY }),
    ]);

    expect(named).toStrictEqual(expected);
    expect(unnamed).toStrictEqual(expected);
  });

  it("estimates the days of a year the notice isn't for, without a source", async () => {
    const { blueprint, examName } = await storedExam({
      days: ["2026-11-08", "2026-11-15"],
      year: 2026,
    });

    await expect(
      findExamFacts({ examName, examYear: 2028, language: "en", today: TODAY }),
    ).resolves.toStrictEqual({
      blueprintId: blueprint.id,
      dates: [
        { date: "2028-11-12", estimated: true, label: "Day 1", source: null },
        { date: "2028-11-19", estimated: true, label: "Day 2", source: null },
      ],
    });
  });

  it("estimates the next edition when no year is named and every stored day has passed", async () => {
    const { blueprint, examName } = await storedExam({
      days: ["2025-11-09", "2025-11-16"],
      year: 2025,
    });

    await expect(findExamFacts({ examName, language: "en", today: TODAY })).resolves.toStrictEqual({
      blueprintId: blueprint.id,
      dates: [
        { date: "2026-11-08", estimated: true, label: "Day 1", source: null },
        { date: "2026-11-15", estimated: true, label: "Day 2", source: null },
      ],
    });
  });

  it("has no dates for a year that has passed, and nothing for an exam not read yet", async () => {
    const { blueprint, examName } = await storedExam({ days: ["2026-11-08"], year: 2026 });

    await expect(
      findExamFacts({ examName, examYear: 2025, language: "en", today: TODAY }),
    ).resolves.toStrictEqual({ blueprintId: blueprint.id, dates: [] });

    await expect(
      findExamFacts({
        examName: `Unknown Exam ${randomUUID()}`,
        examYear: 2028,
        language: "en",
        today: TODAY,
      }),
    ).resolves.toStrictEqual({ blueprintId: null, dates: [] });
  });
});
