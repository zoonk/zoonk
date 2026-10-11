import { describe, expect, it } from "vitest";
import { DOCUMENTS, NOTICE, blueprintExtraction } from "./_test-utils/blueprint-extraction";
import { findStatedTopics, listBlueprintFacts, toCitedFacts } from "./blueprint-facts";

/** A format whose count of questions in its section is quoted apart from it. */
function countedFormat({
  countPassage,
  kind,
}: {
  countPassage: string;
  kind: "multipleChoice" | "numeric";
}) {
  return {
    count: { per: "section" as const, unit: "questions" as const, value: 4 },
    countPassage,
    description: kind,
    document: 1,
    entry: null,
    kind,
    markingPassage: null,
    options: null,
    partialCredit: null,
    passage: NOTICE.slice(0, 40),
    select: null,
  };
}

describe(listBlueprintFacts, () => {
  it("marks facts whose passage isn't in the cited document, or cite a missing one", () => {
    const facts = listBlueprintFacts({ documents: DOCUMENTS, extraction: blueprintExtraction() });
    const found = Object.fromEntries(facts.map((fact) => [fact.id, fact.found]));

    expect(found).toMatchObject({
      "formats.0": true,
      "mock.scoring": true,
      reusePolicy: true,
      "rules.0": false,
      "subjects.0": true,
      "subjects.1": false,
    });

    expect(toCitedFacts(facts).map((fact) => fact.id)).not.toContain("rules.0");
  });

  it("gives every detail its own claim, so a subject's claim names only the subject", () => {
    const facts = listBlueprintFacts({ documents: DOCUMENTS, extraction: blueprintExtraction() });
    const statements = Object.fromEntries(facts.map((fact) => [fact.id, fact.statement]));

    expect(statements).toMatchObject({
      // A kind is named by everything it covers, as the reading files it: picking words in a text is
      // multiple choice too.
      "formats.0":
        "Question format: multiple-choice questions, answered by picking among given options or by picking words or items in a text",
      "formats.0.description": "Question format: Múltipla escolha com cinco alternativas",
      "mock.scoring": "Scoring: scored with item response theory",
      "mock.scoring.description": "Scoring: Proficiência pela TRI",
      "mock.sections.0": 'Exam section "Linguagens"',
      "mock.sections.0.day": 'Exam section "Linguagens" is on exam day 1',
      "mock.sections.0.minutes": 'Exam section "Linguagens" lasts 330 minutes',
      "mock.sections.0.questions": 'Exam section "Linguagens" has 45 questions',
      "subjects.0": 'Subject "Linguagens"',
      "subjects.0.questions": 'Subject "Linguagens" has 45 questions',
      "subjects.0.weight": 'Subject "Linguagens" is worth 25% of the final score',
    });

    expect(statements).not.toHaveProperty(["mock.sections.1.minutes"]);
    expect(statements).not.toHaveProperty(["subjects.1.weight"]);
    expect(statements).toHaveProperty(["subjects.1.questions"]);
  });

  it("reads every passage a claim cites, so a count stated elsewhere can support it", () => {
    const facts = listBlueprintFacts({ documents: DOCUMENTS, extraction: blueprintExtraction() });
    const questions = toCitedFacts(facts).find((fact) => fact.id === "subjects.0.questions");

    expect(questions?.passage).toBe(
      "LINGUAGENS: 1 Língua Portuguesa. 2 Literatura. … Cada prova objetiva terá 45 (quarenta e cinco) questões de múltipla escolha.",
    );
  });

  it("gives a part's claims the found passages quoted elsewhere that name it", () => {
    const facts = listBlueprintFacts({ documents: DOCUMENTS, extraction: blueprintExtraction() });

    const passages = Object.fromEntries(
      toCitedFacts(facts).map((fact) => [fact.id, fact.passage.split(" … ")]),
    );

    expect(passages["mock.sections.0.minutes"]).toStrictEqual([
      "14.3 O cálculo das proficiências terá como base a Teoria de Resposta ao Item (TRI).",
      "Cada prova objetiva terá 45 (quarenta e cinco) questões de múltipla escolha.",
      "LINGUAGENS: 1 Língua Portuguesa. 2 Literatura.",
    ]);

    // Mathematics' own passage cites a document research never read, so no claim borrows it.
    expect(passages["mock.sections.1"]).toHaveLength(2);
    expect(passages["mock.scoring"]).toHaveLength(2);
  });

  it("finds a part's name in any word order, as a notice labels it its own way", () => {
    const discursive = "10.1 A prova discursiva (P4) valerá 50,00 pontos.";
    const extraction = blueprintExtraction();

    const facts = listBlueprintFacts({
      documents: [{ sourceId: "notice", text: `${NOTICE}\n${discursive}` }],
      extraction: {
        ...extraction,
        formats: [
          {
            count: null,
            countPassage: null,
            description: "Discursiva",
            document: 1,
            entry: null,
            kind: "essay",
            markingPassage: null,
            options: null,
            partialCredit: null,
            passage: discursive,
            select: null,
          },
        ],
        mock: {
          ...extraction.mock!,
          sections: [
            {
              breakAfterMinutes: null,
              day: null,
              kind: "written",
              minutes: 240,
              name: "(P4) Discursiva",
              navigation: null,
              passages: [],
              questions: null,
              tasks: [],
              tools: null,
            },
          ],
        },
      },
    });

    const minutes = facts.find((fact) => fact.id === "mock.sections.0.minutes");

    expect(minutes?.found).toBe(true);
    expect(minutes?.citations.map((citation) => citation.passage)).toContain(discursive);
  });

  it("checks a listening part against the lines that state it, apart from the section's summary", () => {
    const summary = "What's in the Listening test? … Number of questions: 40";
    const part = "What's in the Listening test? … Part 1: a conversation in an everyday context";
    const count = "The Listening test has four parts, with 10 questions in each part.";
    const once = "Test takers hear the recordings once only.";
    const extraction = blueprintExtraction();

    const facts = listBlueprintFacts({
      documents: [
        {
          sourceId: "format",
          text: [
            "What's in the Listening test?",
            "Number of questions: 40",
            "Part 1: a conversation in an everyday context",
            count,
            once,
          ].join("\n"),
        },
      ],
      extraction: {
        ...extraction,
        mock: {
          ...extraction.mock!,
          passages: [
            { document: 1, passage: summary },
            { document: 1, passage: once },
          ],
          sections: [
            {
              breakAfterMinutes: null,
              day: null,
              kind: "listening",
              minutes: null,
              name: "Listening",
              navigation: null,
              passages: [],
              questions: 40,
              tasks: [
                {
                  count: 10,
                  // "between two speakers" is the model's own: no line it quotes states it.
                  description: "Part 1: a conversation between two speakers in an everyday context",
                  passages: [
                    { document: 1, passage: part },
                    { document: 1, passage: count },
                    { document: 1, passage: once },
                  ],
                  plays: 1,
                },
              ],
              tools: null,
            },
          ],
        },
      },
    });

    const cited = (id: string) =>
      facts.find((fact) => fact.id === id)?.citations.map((citation) => citation.passage);

    // Each passage once: the section's include the task's own that name it.
    expect(cited("mock.sections.0.tasks.0")).toStrictEqual([part, count, once, summary]);
    expect(cited("mock.sections.0.tasks.0.plays")).toStrictEqual([part, count, once, summary]);
    expect(facts.find((fact) => fact.id === "mock.sections.0.tasks.0")?.found).toBe(true);

    // Its questions and plays name the part by the line it quotes for itself, never by the
    // description, whose detail no line states would drop them with it.
    expect(
      facts
        .filter((fact) => fact.id.startsWith("mock.sections.0.tasks.0"))
        .map((fact) => fact.statement),
    ).toStrictEqual([
      `Exam section "Listening": the recording part quoted as "${part}" has 10 questions`,
      'Exam section "Listening" has a recording part: Part 1: a conversation between two speakers in an everyday context',
      `Exam section "Listening": the recording part quoted as "${part}" is played 1 time`,
    ]);
  });

  it("checks a section's time and count against its own lines, though they don't name it", () => {
    const overview = "In IELTS, there are four sections: Listening, Reading, Writing and Speaking.";
    const time = "Summary … Time allowed: 60 minutes";
    const count = "Summary … Number of questions: 40";
    const extraction = blueprintExtraction();

    const facts = listBlueprintFacts({
      documents: [
        {
          sourceId: "format",
          text: [
            overview,
            "What's in the Reading test?",
            "Summary",
            "Time allowed: 60 minutes",
            "Number of questions: 40",
          ].join("\n"),
        },
      ],
      extraction: {
        ...extraction,
        mock: {
          ...extraction.mock!,
          passages: [{ document: 1, passage: overview }],
          sections: [
            {
              breakAfterMinutes: null,
              day: null,
              kind: "objective",
              minutes: 60,
              name: "Reading",
              navigation: null,
              passages: [
                { document: 1, passage: time },
                { document: 1, passage: count },
                { document: 1, passage: overview },
              ],
              questions: 40,
              tasks: [],
              tools: null,
            },
          ],
        },
      },
    });

    const cited = (id: string) =>
      facts.find((fact) => fact.id === id)?.citations.map((citation) => citation.passage);

    // Each passage once: the section's own first, then the mock's.
    expect(cited("mock.sections.0.minutes")).toStrictEqual([time, count, overview]);
    expect(cited("mock.sections.0.questions")).toStrictEqual([time, count, overview]);
    expect(facts.find((fact) => fact.id === "mock.sections.0.minutes")?.found).toBe(true);
  });

  it("checks a format's partial credit against the marking it quotes apart from the format", () => {
    const format = "ONE OR MORE THAN ONE of these four option(s) is(are) correct answer(s).";

    const marking =
      "Partial Marks : +1 If two or more options are correct but ONLY one option is chosen";

    const extraction = blueprintExtraction();

    const facts = listBlueprintFacts({
      documents: [{ sourceId: "notice", text: `${NOTICE}\n${format}\n${marking}` }],
      extraction: {
        ...extraction,
        formats: [
          {
            count: null,
            countPassage: null,
            description: "One or more options correct",
            document: 1,
            entry: null,
            kind: "multipleChoice",
            markingPassage: marking,
            options: 4,
            partialCredit: "perOption",
            passage: format,
            select: "all",
          },
        ],
      },
    });

    const credit = facts.find((fact) => fact.id === "formats.0.partialCredit");

    expect(credit?.found).toBe(true);

    expect(credit?.citations.map((citation) => citation.passage)).toStrictEqual(
      expect.arrayContaining([format, marking]),
    );
  });

  it("names the question type a partial-credit rule or a count is for by its own line, never the model's description", () => {
    const format = "Identify the words in the transcript that differ from what is said.";
    const marking = "For any wrong options chosen, one point is deducted.";

    const facts = listBlueprintFacts({
      documents: [{ sourceId: "notice", text: `${NOTICE}\n${format}\n${marking}` }],
      extraction: {
        ...blueprintExtraction(),
        formats: [
          {
            count: { per: "section", unit: "questions", value: 3 },
            countPassage: null,
            description: "Select the words that differ from the recording, three tasks a test",
            document: 1,
            entry: null,
            kind: "multipleChoice",
            markingPassage: marking,
            options: null,
            partialCredit: "plusMinus",
            passage: format,
            select: "all",
          },
        ],
      },
    });

    const statements = ["formats.0.partialCredit", "formats.0.count"].map(
      (id) => facts.find((fact) => fact.id === id)?.statement,
    );

    // The description, written by the model, is checked on its own claim: a detail it adds that no
    // line states must not drop the rule or the count.
    for (const statement of statements) {
      expect(statement).toContain(format);
      expect(statement).not.toContain("three tasks a test");
    }
  });

  it("checks a format's count against the line that counts it, never another format's", () => {
    const single =
      "SECTION 1 This section contains FOUR (04) questions with ONLY ONE correct option.";

    const numeric =
      "SECTION 3 This section contains FOUR (04) questions. The answer is a NUMERICAL VALUE.";

    const facts = listBlueprintFacts({
      documents: [{ sourceId: "notice", text: `${NOTICE}\n${single}\n${numeric}` }],
      extraction: {
        ...blueprintExtraction(),
        formats: [
          countedFormat({ countPassage: single, kind: "multipleChoice" }),
          countedFormat({ countPassage: numeric, kind: "numeric" }),
        ],
        mock: null,
      },
    });

    const count = facts.find((fact) => fact.id === "formats.1.count");

    expect(count?.found).toBe(true);
    expect(count?.statement).toContain(": 4");
    expect(count?.citations.map((citation) => citation.passage)).toContain(numeric);
    expect(count?.citations.map((citation) => citation.passage)).not.toContain(single);
  });
});

describe(findStatedTopics, () => {
  it("keeps the topics the cited document states word for word, across PDF line breaks", () => {
    const [subject] = blueprintExtraction().subjects;

    expect(findStatedTopics({ documents: DOCUMENTS, subject: subject! })).toStrictEqual([
      "Língua Portuguesa",
      "Língua Estrangeira (Inglês ou Espanhol)",
    ]);
  });

  it("keeps a document's topics when it has no text to search, like its passages", () => {
    const [subject] = blueprintExtraction().subjects;

    expect(
      findStatedTopics({ documents: [{ sourceId: "photo", text: null }], subject: subject! }),
    ).toStrictEqual(subject!.topics);
  });
});
