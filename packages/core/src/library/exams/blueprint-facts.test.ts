import { describe, expect, it } from "vitest";
import { DOCUMENTS, NOTICE, blueprintExtraction } from "./_test-utils/blueprint-extraction";
import { findStatedTopics, listBlueprintFacts, toCitedFacts } from "./blueprint-facts";

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
      "formats.0": "Question format: multiple-choice questions",
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

    // Matemática's own passage cites a document research never read, so no claim borrows it.
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
            description: "Discursiva",
            document: 1,
            kind: "essay",
            options: null,
            passage: discursive,
          },
        ],
        mock: {
          ...extraction.mock!,
          sections: [{ day: null, minutes: 240, name: "(P4) Discursiva", questions: null }],
        },
      },
    });

    const minutes = facts.find((fact) => fact.id === "mock.sections.0.minutes");

    expect(minutes?.found).toBe(true);
    expect(minutes?.citations.map((citation) => citation.passage)).toContain(discursive);
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
