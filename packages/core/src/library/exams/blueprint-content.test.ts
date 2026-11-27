import { describe, expect, it } from "vitest";
import { DOCUMENTS, blueprintExtraction } from "./_test-utils/blueprint-extraction";
import { isUsableBlueprint, toBlueprintContent, toReusePolicy } from "./blueprint-content";
import { listBlueprintFacts, toCitedFacts } from "./blueprint-facts";
import { listWrittenTasks } from "./written-tasks";

const DETAILS = /\.(?:day|description|minutes|questions|weight)$/u;

const perSubject = (value: number) => ({
  per: "subject" as const,
  unit: "questions" as const,
  value,
});

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

function withListening() {
  const base = blueprintExtraction();

  const listening = {
    breakAfterMinutes: null,
    day: null,
    kind: "listening" as const,
    minutes: 30,
    name: "Listening",
    navigation: null,
    passages: [],
    questions: 40,
    tasks: [
      { count: 10, description: "Part 1: a conversation; form completion", plays: 1 },
      { count: 10, description: "Part 2: a monologue; multiple choice", plays: 2 },
      { count: 20, description: "Parts 3 and 4: a discussion and a lecture", plays: 3 },
    ].map((task) => ({
      ...task,
      passages: [{ document: 1, passage: "| Aplicação | 8/11 e 15/11/2026 |" }],
    })),
    tools: null,
  };

  return {
    ...base,
    mock: base.mock && { ...base.mock, sections: [...base.mock.sections, listening] },
  };
}

const NEWS_TOTAL =
  "A objetiva, de caráter eliminatório e classificatório, será composta de 70 questões de múltipla escolha.";

const NEWS_ESSAY =
  "Já a discursiva (redação), de caráter eliminatório, avaliará as habilidades de escrita do candidato.";

const NEWS_DOCUMENTS = [{ sourceId: "news", text: `Prova\n${NEWS_TOTAL} ${NEWS_ESSAY}` }];

function readNewsPage({
  keep = () => true,
  subjects = [],
}: {
  keep?: (id: string) => boolean;
  subjects?: { name: string; passage: string; questions: number | null }[];
} = {}) {
  const base = blueprintExtraction();
  const [choice] = base.formats;

  const subject = (name: string, passage: string, questions: number | null) => ({
    ...base.subjects[1]!,
    name,
    passages: [{ document: 1, passage }],
    questions,
    shortName: name,
  });

  const extraction = blueprintExtraction({
    dates: [],
    edition: {
      passages: [{ document: 1, passage: NEWS_TOTAL }],
      questionCount: 70,
      timeZone: null,
      year: null,
    },
    formats: [
      {
        ...choice!,
        count: { per: "exam", unit: "questions", value: 70 },
        countPassage: NEWS_TOTAL,
        passage: NEWS_TOTAL,
      },
      { ...choice!, description: "Redação", kind: "essay", passage: NEWS_ESSAY },
    ],
    mock: null,
    reusePolicy: { document: 1, passage: "", pastQuestions: "unknown" },
    rules: [],
    subjects: [
      subject("Discursiva (redação)", NEWS_ESSAY, null),
      ...subjects.map((item) => subject(item.name, item.passage, item.questions)),
    ],
  });

  const facts = listBlueprintFacts({ documents: NEWS_DOCUMENTS, extraction });

  return toBlueprintContent({
    documents: NEWS_DOCUMENTS,
    extraction,
    facts,
    noticeUrl: "https://www.tjsp.jus.br/Noticias/Noticia?codigoNoticia=108814",
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

  it("keeps how a format's questions are answered only when the notice says so", () => {
    const extraction = blueprintExtraction();
    const [choice] = extraction.formats;

    const content = readWith({
      extraction: {
        ...extraction,
        formats: [
          { ...choice!, select: "all" },
          { ...choice!, entry: { kind: "integer", places: null }, kind: "numeric" },
          { ...choice!, select: 1 },
        ],
      },
      keep: () => true,
    });

    expect(
      content.structure.formats.map(({ entry, kind, select }) => ({ entry, kind, select })),
    ).toStrictEqual([
      { entry: undefined, kind: "multipleChoice", select: "all" },
      { entry: { kind: "integer", places: null }, kind: "numeric", select: undefined },
      { entry: undefined, kind: "multipleChoice", select: undefined },
    ]);

    expect(content.structure.formats[2]).not.toHaveProperty("select");
  });

  it("ties a format only to the exam's own parts, in their spelling, and to every part otherwise", () => {
    const extraction = blueprintExtraction();
    const [choice] = extraction.formats;

    const content = readWith({
      extraction: {
        ...extraction,
        formats: [
          { ...choice!, sections: ["matemática", "Section B"] },
          { ...choice!, kind: "trueFalse", sections: ["Parte B"] },
        ],
      },
      keep: () => true,
    });

    expect(content.structure.formats.map((format) => format.sections)).toStrictEqual([
      ["Matemática"],
      undefined,
    ]);
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

  it("keeps how many times a listening part is played only when the check found it", () => {
    const content = readWith({
      extraction: withListening(),
      keep: (id) => id !== "mock.sections.2.tasks.1.plays",
    });

    expect(content.structure.mock?.sections[2]?.tasks).toStrictEqual([
      { count: 10, description: "Part 1: a conversation; form completion", plays: 1 },
      { count: 10, description: "Part 2: a monologue; multiple choice" },
      { count: 20, description: "Parts 3 and 4: a discussion and a lecture" },
    ]);
  });

  it("keeps a listening part's questions and plays when the check drops its description", () => {
    const content = readWith({
      extraction: withListening(),
      keep: (id) =>
        id !== "mock.sections.2.tasks.0.description" && id !== "mock.sections.2.tasks.2",
    });

    expect(content.structure.mock?.sections[2]?.tasks).toStrictEqual([
      { count: 10, description: "", plays: 1 },
      { count: 10, description: "Part 2: a monologue; multiple choice", plays: 2 },
    ]);
  });

  it("keeps the language the exam tests as a code, only when its claim was kept", () => {
    const passage = "PTE Academic is a computer-based academic English test for study or work.";
    const documents = [{ sourceId: "pte", text: `What is PTE Academic? ${passage}` }];

    const read = ({ keep = true, language }: { keep?: boolean; language: string }) => {
      const extraction = blueprintExtraction({
        testedLanguage: { document: 1, language, passage },
      });

      const facts = listBlueprintFacts({ documents, extraction });
      const ids = facts.map((fact) => fact.id);

      const content = toBlueprintContent({
        documents,
        extraction,
        facts,
        noticeUrl: null,
        sourceHash: "hash",
        supportedIds: keep ? ids : ids.filter((id) => id !== "testedLanguage"),
      });

      return { claim: facts.find((fact) => fact.id === "testedLanguage"), content };
    };

    const kept = read({ language: "en-GB" });

    expect(kept.claim?.statement).toBe("The exam tests candidates' command of English");

    expect(kept.content.structure.testedLanguage).toStrictEqual({
      citation: { passage, sourceId: "pte" },
      language: "en",
    });

    expect(read({ keep: false, language: "en" }).content.structure.testedLanguage).toBeNull();

    const named = read({ language: "English" });

    expect(named.claim).toBeUndefined();
    expect(named.content.structure.testedLanguage).toBeNull();
    expect(readWith({ keep: () => true }).structure.testedLanguage).toBeNull();
  });

  it("keeps how a section moves and the notice's score scale only when their claims were kept", () => {
    const base = blueprintExtraction();

    const forwardOnly = {
      answerChanges: 3,
      forwardOnly: true,
      itemSeconds: null,
      mustAnswer: true,
    };

    const scale = {
      fromPercent: { base: 700, perPercent: 6 },
      max: 1300,
      min: 700,
      name: "Índice Ceneval",
      passScore: null,
      step: 1,
    };

    const extraction = {
      ...base,
      mock: base.mock && {
        ...base.mock,
        scoring: { ...base.mock.scoring, method: "scaled" as const, scale },
        sections: base.mock.sections.map((section, index) =>
          index === 0 ? { ...section, navigation: forwardOnly } : section,
        ),
      },
    };

    const kept = readWith({ extraction, keep: () => true }).structure.mock;

    expect(kept?.sections[0]?.navigation).toStrictEqual(forwardOnly);
    expect(kept?.sections[1]).not.toHaveProperty("navigation");
    expect(kept?.scoring.scale).toStrictEqual(scale);

    const unchecked = readWith({
      extraction,
      keep: (id) => !id.endsWith(".navigation") && id !== "mock.scoring.scale",
    }).structure.mock;

    expect(unchecked?.sections[0]).not.toHaveProperty("navigation");
    expect(unchecked?.scoring).not.toHaveProperty("scale");
  });

  it("keeps how a question with several picks scores partly right answers only when its claim was kept", () => {
    const base = blueprintExtraction();
    const [first] = base.formats;

    const extraction = {
      ...base,
      formats: first
        ? [{ ...first, options: 4, partialCredit: "perOption" as const, select: "all" as const }]
        : [],
    };

    const kept = readWith({ extraction, keep: () => true }).structure.formats[0];

    expect(kept).toMatchObject({ partialCredit: "perOption", select: "all" });

    const unchecked = readWith({ extraction, keep: (id) => !id.endsWith(".partialCredit") })
      .structure.formats[0];

    expect(unchecked).toMatchObject({ select: "all" });
    expect(unchecked).not.toHaveProperty("partialCredit");
  });

  it("works out each format's share from the counts the check kept", () => {
    const base = blueprintExtraction();
    const [first] = base.formats;

    const extraction = {
      ...base,
      formats: first
        ? [
            { ...first, count: perSubject(20) },
            { ...first, count: perSubject(5), kind: "numeric" as const },
          ]
        : [],
    };

    const shares = (keep: (id: string) => boolean) =>
      readWith({ extraction, keep }).structure.formats.map((format) => format.share);

    expect(shares(() => true)).toStrictEqual([0.8, 0.2]);

    expect(shares((id) => id !== "formats.1.count")).toStrictEqual([undefined, undefined]);
  });

  it("drops a scale conversion that leaves the scale, and a review in a section that moves freely", () => {
    const base = blueprintExtraction();

    const extraction = {
      ...base,
      mock: base.mock && {
        ...base.mock,
        scoring: {
          ...base.mock.scoring,
          method: "scaled" as const,
          scale: {
            fromPercent: { base: 700, perPercent: 10 },
            max: 1300,
            min: 700,
            name: null,
            passScore: 1500,
            step: null,
          },
        },
        sections: base.mock.sections.map((section) => ({
          ...section,
          navigation: { answerChanges: 3, forwardOnly: false, itemSeconds: 0, mustAnswer: true },
        })),
      },
    };

    const mock = readWith({ extraction, keep: () => true }).structure.mock;

    expect(mock?.scoring.scale).toStrictEqual({
      fromPercent: null,
      max: 1300,
      min: 700,
      name: null,
      passScore: null,
      step: null,
    });

    expect(mock?.sections[0]?.navigation).toStrictEqual({
      answerChanges: null,
      forwardOnly: false,
      itemSeconds: null,
      mustAnswer: true,
    });
  });

  it("keeps the notice's penalty for a wrong answer only when its numbers state it", () => {
    const base = blueprintExtraction();

    const mock = base.mock && {
      ...base.mock,
      scoring: {
        ...base.mock.scoring,
        description: "+4 por acerto e -1 por erro",
        method: "wrongCancelsRight" as const,
        wrongPenalty: 0.25,
      },
    };

    const extraction = { ...base, mock };

    expect(readWith({ extraction, keep: () => true }).structure.mock?.scoring).toStrictEqual({
      description: "+4 por acerto e -1 por erro",
      method: "wrongCancelsRight",
      wrongPenalty: 0.25,
    });

    const unstated = readWith({ extraction, keep: (id) => id !== "mock.scoring.wrongPenalty" });

    expect(unstated.structure.mock?.scoring).toStrictEqual({
      description: "+4 por acerto e -1 por erro",
      method: "wrongCancelsRight",
    });
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

  it("keeps a choice the check confirmed for two options or more, and only a part of a kept subject", () => {
    const base = blueprintExtraction();
    const [languages, math] = base.subjects;

    const option = (name: string) => ({
      ...languages!,
      choiceGroup: "Língua Estrangeira",
      name,
      partOf: "Linguagens",
      questions: null,
      shortName: name,
      topics: [],
      weight: null,
    });

    const extraction = blueprintExtraction({
      subjects: [
        languages!,
        option("Língua Inglesa"),
        option("Língua Espanhola"),
        { ...option("Língua Francesa"), choiceGroup: null, partOf: "Línguas" },
        { ...math!, passages: languages!.passages },
      ],
    });

    const choices = (keep: (id: string) => boolean) =>
      readWith({ extraction, keep }).structure.subjects.map(({ choiceGroup, name, partOf }) => ({
        choiceGroup: choiceGroup ?? null,
        name,
        partOf: partOf ?? null,
      }));

    expect(choices(() => true)).toStrictEqual([
      { choiceGroup: null, name: "Linguagens", partOf: null },
      { choiceGroup: "Língua Estrangeira", name: "Língua Inglesa", partOf: "Linguagens" },
      { choiceGroup: "Língua Estrangeira", name: "Língua Espanhola", partOf: "Linguagens" },
      { choiceGroup: null, name: "Língua Francesa", partOf: null },
      { choiceGroup: null, name: "Matemática", partOf: null },
    ]);

    expect(
      choices((id) => id !== "subjects.2.choiceGroup").map((subject) => subject.choiceGroup),
    ).toStrictEqual([null, null, null, null, null]);
  });

  it("keeps how many options candidates take only when its claim was kept and the choice is real, with every option", () => {
    const base = blueprintExtraction();
    const [languages, math] = base.subjects;
    const passages = languages!.passages;

    const option = (name: string) => ({
      ...math!,
      choiceGroup: "Módulos",
      name,
      passages,
      questions: 24,
    });

    const read = ({
      keep = () => true,
      modules,
    }: {
      keep?: (id: string) => boolean;
      modules: string[];
    }) =>
      readWith({
        extraction: blueprintExtraction({
          choiceGroups: [{ name: "Módulos", passages, take: 2 }],
          subjects: [languages!, ...modules.map((name) => option(name))],
        }),
        keep,
      }).structure;

    const three = ["Biología", "Química", "Derecho"];

    expect(read({ modules: three }).choiceGroups).toStrictEqual([{ name: "Módulos", take: 2 }]);

    expect(
      read({ keep: (id) => id !== "choiceGroups.0", modules: three }).choiceGroups,
    ).toBeUndefined();

    const dropped = (keep: (id: string) => boolean) =>
      read({ keep, modules: three }).subjects.map((subject) => subject.choiceGroup ?? null);

    expect(dropped((id) => id !== "subjects.2.choiceGroup")).toStrictEqual([
      null,
      "Módulos",
      "Módulos",
      "Módulos",
    ]);

    expect(
      dropped((id) => id !== "subjects.2.choiceGroup" && id !== "choiceGroups.0"),
    ).toStrictEqual([null, "Módulos", null, "Módulos"]);

    const two = read({ modules: ["Biología", "Química"] });

    expect(two.choiceGroups).toBeUndefined();

    expect(two.subjects.map((subject) => subject.choiceGroup ?? null)).toStrictEqual([
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
    const subjectsOnly = readWith({ keep: (id) => /^subjects\.\d+$/u.test(id) });
    const withDay = readWith({ keep: (id) => /^subjects\.\d+$/u.test(id) || id === "dates.0" });

    expect(isUsableBlueprint({ content: subjectsOnly, shared: true })).toBe(false);
    expect(isUsableBlueprint({ content: subjectsOnly, shared: false })).toBe(true);
    expect(isUsableBlueprint({ content: withDay, shared: true })).toBe(true);
  });

  it("takes the exam's questions from its formats' counts when the check drops the total", () => {
    const content = readNewsPage({ keep: (id) => id !== "edition.questionCount" });

    expect(content.edition.questionCount).toBe(70);
    expect(content.edition.citations).toStrictEqual([{ passage: NEWS_TOTAL, sourceId: "news" }]);

    const uncounted = readNewsPage({
      keep: (id) => !id.startsWith("edition") && !id.endsWith(".count"),
    });

    expect(uncounted.edition.questionCount).toBeNull();
  });

  it("doesn't share a reading that has the objective test's questions but only its essay as a subject", () => {
    const newsOnly = readNewsPage();

    const withSubject = readNewsPage({
      subjects: [{ name: "Língua Portuguesa", passage: NEWS_TOTAL, questions: 16 }],
    });

    expect(isUsableBlueprint({ content: newsOnly, shared: true })).toBe(false);
    expect(isUsableBlueprint({ content: newsOnly, shared: false })).toBe(true);
    expect(isUsableBlueprint({ content: withSubject, shared: true })).toBe(true);
  });
});

describe("a learner's own material", () => {
  const NOTES =
    "# Cinemática - MUV\n\nVelocidade média: $v_m = \\Delta s / \\Delta t$\n\nProva com 10 questões";

  const subject = blueprintExtraction().subjects[0]!;

  const extraction = blueprintExtraction({
    dates: [],
    formats: [],
    mock: null,
    reusePolicy: { document: null, passage: null, pastQuestions: "unknown" },
    rules: [],
    subjects: [
      {
        ...subject,
        name: "Cinemática - MUV",
        passages: [
          { document: 1, passage: "# Cinemática - MUV" },
          { document: 1, passage: "Prova com 10 questões" },
        ],
        questions: 10,
        shortName: "Cinemática",
        topics: ["Velocidade média"],
        weight: null,
      },
      { ...subject, name: "Dinâmica", passages: [{ document: 1, passage: "# Dinâmica" }] },
      {
        ...subject,
        name: "Medieval History",
        passages: [{ document: 1, passage: "# Cinemática - MUV" }],
        questions: null,
        weight: null,
      },
      {
        ...subject,
        name: "Física",
        passages: [{ document: 1, passage: "# Cinemática - MUV" }],
        questions: null,
        topics: ["Velocidade média"],
        weight: null,
      },
    ],
  });

  function read({
    material,
    supportedIds,
    text = NOTES,
  }: {
    material: boolean;
    supportedIds: string[];
    text?: string | null;
  }) {
    const documents = [{ sourceId: "notes", text }];
    const facts = listBlueprintFacts({ documents, extraction, material });

    const content = toBlueprintContent({
      documents,
      extraction,
      facts,
      noticeUrl: null,
      sourceHash: "hash",
      supportedIds,
    });

    return { checked: toCitedFacts(facts).map((fact) => fact.id), content };
  }

  it("keeps a subject its passage names or whose topics the notes state without asking the check, which still judges the exam's details", () => {
    const { checked, content } = read({ material: true, supportedIds: [] });

    expect(checked).toStrictEqual(["subjects.0.questions", "subjects.2"]);

    expect(content.structure.subjects.map((item) => [item.name, item.questions])).toStrictEqual([
      ["Cinemática - MUV", null],
      ["Física", null],
    ]);

    expect(isUsableBlueprint({ content, shared: false })).toBe(true);
  });

  it("leaves to the check a subject the notes neither name nor state a topic of, or notes without text", () => {
    const unnamed = read({ material: true, supportedIds: ["subjects.2"] });
    const unread = read({ material: true, supportedIds: [], text: null });

    expect(unnamed.content.structure.subjects.map((item) => item.name)).toStrictEqual([
      "Cinemática - MUV",
      "Medieval History",
      "Física",
    ]);

    expect(unread.checked).toStrictEqual(expect.arrayContaining(["subjects.0", "subjects.3"]));
    expect(unread.content.structure.subjects).toStrictEqual([]);
  });

  it("leaves an exam notice's subjects to the check", () => {
    const { checked, content } = read({ material: false, supportedIds: [] });

    expect(checked).toStrictEqual([
      "subjects.0",
      "subjects.0.questions",
      "subjects.2",
      "subjects.3",
    ]);

    expect(content.structure.subjects).toStrictEqual([]);
  });
});

describe("a syllabus's topics", () => {
  const SYLLABUS = [
    "(16) questões:",
    "BLOCO I: Língua Portuguesa",
    "Análise, compreensão e interpretação de diversos tipos de textos.",
    "Crase.",
    "Pontuação.",
    "BLOCO II: Conhecimentos em Direito",
    "1. DIREITO PENAL: Código Penal - artigos 293 a 305.",
  ].join("\n");

  const documents = [{ sourceId: "copy", text: SYLLABUS }];

  function readTopics(subjects: { name: string; passage: string; topics: string[] }[]) {
    const base = blueprintExtraction();

    const extraction = blueprintExtraction({
      subjects: subjects.map(({ name, passage, topics }) => ({
        ...base.subjects[1]!,
        name,
        passages: [{ document: 1, passage }],
        questions: null,
        shortName: name,
        topics,
      })),
    });

    const facts = listBlueprintFacts({ documents, extraction });

    return toBlueprintContent({
      documents,
      extraction,
      facts,
      noticeUrl: null,
      sourceHash: "hash",
      supportedIds: facts.map((fact) => fact.id),
    }).structure.subjects.map((subject) => subject.topics);
  }

  it("keeps the items the syllabus doesn't number when the reading numbered them", () => {
    expect(
      readTopics([
        {
          name: "Língua Portuguesa",
          passage: "BLOCO I: Língua Portuguesa",
          topics: [
            "1. Análise, compreensão e interpretação de diversos tipos de textos",
            "2. Crase",
            "3. Pontuação",
            "4. Regência verbal e nominal",
          ],
        },
        {
          name: "Conhecimentos em Direito",
          passage: "BLOCO II: Conhecimentos em Direito",
          topics: ["1. DIREITO PENAL: Código Penal - artigos 293 a 305"],
        },
      ]),
    ).toStrictEqual([
      ["Análise, compreensão e interpretação de diversos tipos de textos", "Crase", "Pontuação"],
      ["1. DIREITO PENAL: Código Penal - artigos 293 a 305"],
    ]);
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

describe("keeping written facts from a checked notice", () => {
  type Reading = ReturnType<typeof blueprintExtraction>;
  type Mock = NonNullable<Reading["mock"]>;
  type Section = Mock["sections"][number];
  type Task = Section["tasks"][number];

  const task = {
    count: 1,
    description: "an essay",
    grading: null,
    lines: 30,
    passages: [{ document: 1, passage: "The written test asks for an essay of at most 30 lines." }],
    plays: null,
    points: null,
  } satisfies Task;

  const written = {
    breakAfterMinutes: null,
    day: null,
    kind: "written",
    minutes: null,
    name: "Written test",
    navigation: null,
    passages: [],
    questions: null,
    tasks: [task],
    tools: null,
  } satisfies Section;

  function check({
    sections,
    source,
    support,
  }: {
    sections: Section[];
    source: string;
    support: (fact: ReturnType<typeof listBlueprintFacts>[number]) => boolean;
  }) {
    const base = blueprintExtraction();
    const extraction = { ...base, mock: { ...base.mock!, passages: [], sections } };
    const documents = [{ sourceId: "notice", text: source }];
    const facts = listBlueprintFacts({ documents, extraction });

    return toBlueprintContent({
      documents,
      extraction,
      facts,
      noticeUrl: null,
      sourceHash: "fixture",
      supportedIds: facts.filter((fact) => support(fact)).map(({ id }) => id),
    }).structure;
  }

  it("names the Enem sitting and its day so the checker can support the combined clock", () => {
    const first =
      "On exam day 1, the objective test and essay share a single sitting of 330 minutes.";

    const second = "On exam day 2, the objective test has a single sitting of 300 minutes.";

    const sections: Section[] = [
      {
        ...written,
        day: 1,
        kind: "objective",
        minutes: 330,
        name: "Day 1",
        passages: [{ document: 1, passage: first }],
        tasks: [],
      },
      {
        ...written,
        day: 1,
        minutes: 330,
        name: "Day 1",
        passages: [{ document: 1, passage: first }],
      },
      {
        ...written,
        day: 2,
        kind: "objective",
        minutes: 300,
        name: "Day 2",
        passages: [{ document: 1, passage: second }],
        tasks: [],
      },
    ];

    const structure = check({
      sections,
      source: `${first}\n${second}\n${task.passages[0]!.passage}`,
      support: ({ id, statement }) =>
        !id.endsWith(".minutes") ||
        statement.includes(id.includes(".2.") ? "exam day 2" : "exam day 1"),
    });

    expect(structure.mock?.sections.map(({ minutes }) => minutes)).toStrictEqual([330, 330, 300]);
    expect(listWrittenTasks({ structure })).toMatchObject([{ minutes: null }]);
  });

  it("keeps an OAB task's verified points when a conduct rule fails and drops a checked administration rule", () => {
    const score = "The professional brief is worth 5 points for applying the relevant law.";
    const form = "Choosing an unsuitable type of brief results in a score of zero.";
    const conduct = "Candidates must copy the answer in the specified order.";
    const signature = "Candidates must sign only the cover sheet.";

    const section = {
      ...written,
      tasks: [
        {
          ...task,
          description: "a professional brief",
          grading: {
            combination: null,
            conventions: [],
            criteria: [
              {
                awards: [],
                document: 1,
                id: "brief",
                parts: [],
                passage: score,
                points: 5,
                text: "Applying the relevant law",
                weight: null,
              },
            ],
            deductions: [],
            language: null,
            limits: [],
            rounding: null,
            zeroing: [
              {
                document: 1,
                kinds: ["other"],
                maxLines: null,
                passage: signature,
                text: signature,
              },
              { document: 1, kinds: ["other"], maxLines: null, passage: conduct, text: conduct },
              { document: 1, kinds: ["wrongForm"], maxLines: null, passage: form, text: form },
            ],
          },
          passages: [{ document: 1, passage: score }],
          points: 5,
        },
      ],
    } satisfies Section;

    const structure = check({
      sections: [section],
      source: [score, form, conduct, signature].join("\n"),
      support: ({ id }) => id !== "mock.sections.0.tasks.0.grading.zeroing.0",
    });

    expect(listWrittenTasks({ structure })).toMatchObject([
      {
        grading: {
          criteria: [{ id: "brief", points: 5 }],
          zeroing: [{ kinds: ["wrongForm"], text: form }],
        },
        points: 5,
      },
    ]);

    expect(listWrittenTasks({ structure })[0]?.grading.zeroing).toHaveLength(1);
  });

  it("keeps a no-scale mock whose cited task establishes its section", () => {
    const structure = check({
      sections: [written],
      source: task.passages[0]!.passage,
      support: ({ id }) =>
        id === "mock.sections.0.tasks.0" || id === "mock.sections.0.tasks.0.lines",
    });

    expect(listWrittenTasks({ structure })).toMatchObject([
      { description: "an essay", grading: { criteria: [] }, lines: 30, points: null },
    ]);
  });
});
