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
        group: null,
        name: "Linguagens",
        questions: 45,
        shortName: null,
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

    expect(isUsableBlueprint({ content, shared: true })).toBe(true);
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

    expect(isUsableBlueprint({ content, shared: true })).toBe(true);
  });

  it("keeps a mock's sections only as a whole, and its days only when every one was kept", () => {
    const withoutSection = readWith({ keep: (id) => id !== "mock.sections.1" });
    const withoutDay = readWith({ keep: (id) => id !== "mock.sections.1.day" });

    expect(withoutSection.structure.mock?.sections).toStrictEqual([]);

    expect(withoutDay.structure.mock?.sections).toStrictEqual([
      { day: null, kind: "objective", minutes: 330, name: "Linguagens", questions: 45, tasks: [] },
      { day: null, kind: "objective", minutes: null, name: "Matemática", questions: 45, tasks: [] },
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

  /*
   * Lucas's ENEM topics were the matrix's long competência and habilidade statements; candidates
   * study its contents ("Hereditariedade e diversidade da vida"), with the statements as detail.
   */
  it("keeps a skills matrix's statements as detail when the topics are its contents", () => {
    const documents = [
      {
        sourceId: "notice",
        text: [
          "H13 – Reconhecer mecanismos de transmissão da vida, prevendo ou explicando a manifestação de características dos seres vivos.",
          "Objetos de conhecimento associados às Matrizes de Referência",
          "Moléculas, células e tecidos - Estrutura e fisiologia celular: membrana, citoplasma e núcleo.",
          "Hereditariedade e diversidade da vida - Princípios básicos que regem a transmissão de características hereditárias.",
        ].join("\n"),
      },
    ];

    const base = blueprintExtraction();
    const [, math] = base.subjects;

    const extraction = blueprintExtraction({
      subjects: [
        {
          ...math!,
          matrix: [
            "H13 – Reconhecer mecanismos de transmissão da vida, prevendo ou explicando a manifestação de características dos seres vivos",
            "H99 – Uma habilidade que o documento não traz",
          ],
          name: "Ciências da Natureza e suas Tecnologias",
          passages: [
            {
              document: 1,
              passage: "Objetos de conhecimento associados às Matrizes de Referência",
            },
          ],
          topics: ["Moléculas, células e tecidos", "Hereditariedade e diversidade da vida"],
        },
      ],
    });

    const facts = listBlueprintFacts({ documents, extraction });

    const content = toBlueprintContent({
      documents,
      extraction,
      facts,
      noticeUrl: null,
      sourceHash: "hash",
      supportedIds: facts.map((fact) => fact.id),
    });

    const [natureza] = content.structure.subjects;

    expect(natureza).toMatchObject({
      matrix: [
        "H13 – Reconhecer mecanismos de transmissão da vida, prevendo ou explicando a manifestação de características dos seres vivos",
      ],
      topics: ["Moléculas, células e tecidos", "Hereditariedade e diversidade da vida"],
    });
  });

  it("keeps the notice's headings over a subject's topics when its documents state them", () => {
    const documents = [
      {
        sourceId: "notice",
        text: [
          "Objetos de conhecimento associados às Matrizes de Referência",
          "FÍSICA",
          "Energia, trabalho e potência",
          "O calor e os fenômenos térmicos",
          "QUÍMICA",
          "Transformações químicas.",
          "BIOLOGIA",
          "Moléculas, células e tecidos",
        ].join("\n"),
      },
    ];

    const [, math] = blueprintExtraction().subjects;

    const extraction = blueprintExtraction({
      subjects: [
        {
          ...math!,
          name: "Ciências da Natureza e suas Tecnologias",
          passages: [
            {
              document: 1,
              passage: "Objetos de conhecimento associados às Matrizes de Referência",
            },
          ],
          topicHeadings: [
            { firstTopic: "Energia, trabalho e potência", name: "Física" },
            { firstTopic: "Transformações químicas.", name: "Química" },
            { firstTopic: "Moléculas, células e tecidos", name: "Biologia" },
            { firstTopic: "Ecologia", name: "Ecologia e ambiente" },
          ],
          topics: [
            "Energia, trabalho e potência",
            "O calor e os fenômenos térmicos",
            "Uma linha que o documento não traz",
            "Transformações químicas.",
            "Moléculas, células e tecidos",
          ],
        },
      ],
    });

    const facts = listBlueprintFacts({ documents, extraction });

    const content = toBlueprintContent({
      documents,
      extraction,
      facts,
      noticeUrl: null,
      sourceHash: "hash",
      supportedIds: facts.map((fact) => fact.id),
    });

    expect(content.structure.subjects[0]?.topicGroups).toStrictEqual([
      {
        name: "Física",
        topics: ["Energia, trabalho e potência", "O calor e os fenômenos térmicos"],
      },
      { name: "Química", topics: ["Transformações químicas"] },
      { name: "Biologia", topics: ["Moléculas, células e tecidos"] },
    ]);
  });

  it("stores no headings for a syllabus listed without them", () => {
    const content = readWith({ keep: () => true });

    expect(content.structure.subjects[0]).not.toHaveProperty("topicGroups");
  });

  it("puts subjects in a group the check confirmed for one of them, with short names and topic lines", () => {
    const base = blueprintExtraction();
    const [languages, math] = base.subjects;

    const extraction = blueprintExtraction({
      subjects: [
        {
          ...languages!,
          group: "1º dia",
          topics: ["Língua Portuguesa.", "Língua Portuguesa", "Literatura;"],
        },
        { ...math!, group: "1º dia", passages: languages!.passages },
        {
          ...math!,
          group: "2º dia",
          name: "Ciências da Natureza e suas Tecnologias",
          passages: languages!.passages,
          shortName: " Natureza ",
        },
      ],
    });

    const content = readWith({ extraction, keep: (id) => id !== "subjects.1.group" });

    expect(
      content.structure.subjects.map(({ group, name, shortName, topics }) => ({
        group,
        name,
        shortName,
        topics,
      })),
    ).toStrictEqual([
      {
        group: "1º dia",
        name: "Linguagens",
        shortName: null,
        topics: ["Língua Portuguesa", "Literatura"],
      },
      { group: "1º dia", name: "Matemática", shortName: null, topics: [] },
      {
        group: "2º dia",
        name: "Ciências da Natureza e suas Tecnologias",
        shortName: "Natureza",
        topics: [],
      },
    ]);

    const unconfirmed = readWith({ extraction, keep: (id) => !id.endsWith(".group") });

    expect(unconfirmed.structure.subjects.map((subject) => subject.group)).toStrictEqual([
      null,
      null,
      null,
    ]);
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
    const content = readWith({ keep: (id) => id === "dates.0" });

    expect(isUsableBlueprint({ content, shared: false })).toBe(false);
  });

  it("shares only an exam's own documents: subjects alone may come from a curriculum", () => {
    // What a curriculum like the BNCC states too: the subjects and their topics, nothing that
    // says how an exam asks them, when, or how much each counts.
    const subjectsOnly = readWith({ keep: (id) => /^subjects\.\d+$/u.test(id) });
    const withDay = readWith({ keep: (id) => /^subjects\.\d+$/u.test(id) || id === "dates.0" });

    expect(isUsableBlueprint({ content: subjectsOnly, shared: true })).toBe(false);
    expect(isUsableBlueprint({ content: subjectsOnly, shared: false })).toBe(true);
    expect(isUsableBlueprint({ content: withDay, shared: true })).toBe(true);
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
