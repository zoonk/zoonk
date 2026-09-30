import { describe, expect, it } from "vitest";
import { DOCUMENTS, blueprintExtraction } from "./_test-utils/blueprint-extraction";
import { isUsableBlueprint, toBlueprintContent, toReusePolicy } from "./blueprint-content";
import { listBlueprintFacts } from "./blueprint-facts";

const DETAILS = /\.(?:day|description|minutes|questions|weight)$/u;

function readWith({
  extraction = blueprintExtraction(),
  keep,
}: {
  extraction?: ReturnType<typeof blueprintExtraction>;
  keep: (id: string) => boolean;
}) {
  const facts = listBlueprintFacts({ documents: DOCUMENTS, extraction });

  return toBlueprintContent({
    documents: DOCUMENTS,
    extraction,
    facts,
    noticeUrl: "https://example.gov.br/edital.pdf",
    sourceHash: "hash",
    supportedIds: facts.map((fact) => fact.id).filter((id) => keep(id)),
  });
}

describe(toBlueprintContent, () => {
  it("keeps only facts both checks accepted, with their passages, and drops malformed dates", () => {
    const extraction = blueprintExtraction();
    const content = readWith({ extraction, keep: (id) => id !== "formats.0" });

    expect(content.structure.subjects).toStrictEqual([
      {
        citation: { passage: extraction.subjects[0]!.passages[0]!.passage, sourceId: "notice" },
        name: "Linguagens",
        questions: 45,
        topics: ["Língua Portuguesa", "Língua Estrangeira (Inglês ou Espanhol)"],
        weight: 0.25,
      },
    ]);

    expect(content.structure.formats).toStrictEqual([]);
    expect(content.structure.rules).toStrictEqual([]);
    expect(content.structure.mock?.citations).toHaveLength(2);
    expect(content.edition.dates.map((date) => date.date)).toStrictEqual(["2026-11-08"]);

    expect(content.edition).toMatchObject({
      noticeUrl: "https://example.gov.br/edital.pdf",
      sourceHash: "hash",
    });

    expect(isUsableBlueprint(content)).toBe(true);
  });

  it("keeps a subject, format and mock whose details the check rejected, leaving gaps", () => {
    const content = readWith({ keep: (id) => !DETAILS.test(id) });

    expect(content.structure.subjects[0]).toMatchObject({
      name: "Linguagens",
      questions: null,
      weight: null,
    });

    expect(content.structure.formats[0]).toMatchObject({ description: "", kind: "multipleChoice" });

    expect(content.structure.mock).toMatchObject({
      scoring: { description: "", method: "itemResponseTheory" },
      sections: [
        { day: null, minutes: null, name: "Linguagens", questions: null },
        { day: null, minutes: null, name: "Matemática", questions: null },
      ],
    });

    expect(isUsableBlueprint(content)).toBe(true);
  });

  it("keeps a mock's sections only as a whole, and its days only when every one was kept", () => {
    const withoutSection = readWith({ keep: (id) => id !== "mock.sections.1" });
    const withoutDay = readWith({ keep: (id) => id !== "mock.sections.1.day" });

    expect(withoutSection.structure.mock?.sections).toStrictEqual([]);

    expect(withoutDay.structure.mock?.sections).toStrictEqual([
      { day: null, minutes: 330, name: "Linguagens", questions: 45 },
      { day: null, minutes: null, name: "Matemática", questions: 45 },
    ]);
  });

  it("keeps a mock whose scoring wasn't kept with the scoring unknown, and none without conditions", () => {
    const unscored = readWith({ keep: (id) => !id.startsWith("mock.scoring") });

    expect(unscored.structure.mock).toMatchObject({
      scoring: { description: "", method: "other" },
      sections: [{ name: "Linguagens" }, { name: "Matemática" }],
    });

    const empty = readWith({
      keep: (id) => !id.startsWith("mock.") || id.endsWith(".day") || id === "mock.sections.0",
    });

    expect(empty.structure.mock).toBeNull();
  });

  it("keeps a date whose start time the check rejected, without the time", () => {
    const content = readWith({ keep: (id) => id !== "dates.0.startTime" });

    expect(content.edition.dates[0]).toMatchObject({ date: "2026-11-08", startTime: null });
  });

  it("keeps the exam's start time and the notice's time zone, and drops malformed ones", () => {
    const valid = readWith({ keep: () => true });

    expect(valid.edition.dates[0]?.startTime).toBe("13:30");
    expect(valid.edition.timeZone).toBe("America/Sao_Paulo");

    const invalid = readWith({
      extraction: blueprintExtraction({
        edition: { passages: [], questionCount: null, timeZone: "Brasília", year: null },
      }),
      keep: () => true,
    });

    expect(invalid.edition.timeZone).toBeNull();
  });

  it("isn't usable when nothing about the exam's content or conditions survived", () => {
    expect(isUsableBlueprint(readWith({ keep: (id) => id === "dates.0" }))).toBe(false);
  });
});

describe(toReusePolicy, () => {
  it("stores the organizer's own terms when their passage was checked", () => {
    const extraction = blueprintExtraction();
    const facts = listBlueprintFacts({ documents: DOCUMENTS, extraction });

    expect(toReusePolicy({ extraction, facts, supportedIds: ["reusePolicy"] })).toStrictEqual({
      policy: {
        basis: "É permitida a reprodução das questões desde que citada a fonte.",
        honorTakedowns: true,
        pastQuestions: "allowedWithCitation",
        termsUrl: null,
      },
      sourceId: "notice",
    });

    expect(toReusePolicy({ extraction, facts, supportedIds: [] })).toBeNull();
  });
});
