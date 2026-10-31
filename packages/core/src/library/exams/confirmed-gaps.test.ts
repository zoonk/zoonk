import { describe, expect, it } from "vitest";
import { type BlueprintContent } from "./blueprint-contract";
import { carryConfirmedGaps } from "./confirmed-gaps";

const citation = { passage: "Conteúdo programático", sourceId: "notice" };

function subject(name: string, questions: number | null) {
  return { citation, name, questions, topics: [`${name} 1`], weight: null };
}

function reading({
  problems = [],
  subjects,
}: {
  problems?: NonNullable<BlueprintContent["edition"]["check"]>["problems"];
  subjects: ReturnType<typeof subject>[];
}): BlueprintContent {
  return {
    edition: {
      check: { checkedAt: "2026-10-31T00:00:00.000Z", problems },
      citations: [],
      dates: [],
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      timeZone: null,
      year: 2026,
    },
    structure: { formats: [], mock: null, rules: [], subjects },
    topicFrequency: [],
  };
}

function carried(next: BlueprintContent, stored: BlueprintContent) {
  return carryConfirmedGaps({ next, stored }).structure.subjects.map((item) => [
    item.name,
    item.questions,
  ]);
}

describe(carryConfirmedGaps, () => {
  const stored = reading({
    subjects: [subject("Direito Civil", 10), subject("Direito Processual Civil", 15)],
  });

  it("restores only the count the check names, never a subject whose name only contains it", () => {
    const next = reading({
      problems: [{ citation, kind: "missingCount", questions: 10, subject: "Direito Civil" }],
      subjects: [subject("Direito Civil", null), subject("Direito Processual Civil", 20)],
    });

    expect(carried(next, stored)).toStrictEqual([
      ["Direito Civil", 10],
      ["Direito Processual Civil", 20],
    ]);
  });

  it("keeps a missing subject whose name another subject of the reading contains", () => {
    const next = reading({
      problems: [{ citation, kind: "missingSubject", name: "Direito Civil" }],
      subjects: [subject("Direito Processual Civil", 15)],
    });

    expect(carried(next, stored)).toStrictEqual([
      ["Direito Processual Civil", 15],
      ["Direito Civil", 10],
    ]);
  });

  it("matches a shortened name when only one subject can be meant", () => {
    const next = reading({
      problems: [{ citation, kind: "missingSubject", name: "Ética" }],
      subjects: [subject("Direito Civil", 10)],
    });

    const ethics = reading({
      subjects: [subject("Direito Civil", 10), subject("Ética Profissional", 8)],
    });

    expect(carried(next, ethics)).toStrictEqual([
      ["Direito Civil", 10],
      ["Ética Profissional", 8],
    ]);
  });
});
