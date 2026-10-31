import { describe, expect, it } from "vitest";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import reading from "./_test-utils/cgu-2026-structure.json";
import { listExamChoiceViews, listUnpickedLeftOut } from "./exam-choice-views";

const citation = { passage: "…", sourceId: "notice" };
const LANGUAGES = "Linguagens, Códigos e suas Tecnologias";
const FOREIGN = "Língua Estrangeira";

function subject(name: string, questions: number | null, extra: object = {}) {
  return { citation, name, questions, topics: [], weight: null, ...extra };
}

const enem: ExamStructure = {
  formats: [{ citation, description: "Cinco alternativas", kind: "multipleChoice", options: 5 }],
  mock: null,
  rules: [],
  subjects: [
    subject(LANGUAGES, 45),
    subject("Língua Inglesa", 5, { choiceGroup: FOREIGN, partOf: LANGUAGES, shortName: "Inglês" }),
    subject("Língua Espanhola", 5, { choiceGroup: FOREIGN, partOf: LANGUAGES }),
    subject("Matemática e suas Tecnologias", 45),
  ],
};

describe(listExamChoiceViews, () => {
  it("shows each choice's options and the learner's pick, none while unpicked", () => {
    const [view] = listExamChoiceViews({
      choices: [{ group: FOREIGN, subject: "Língua Espanhola" }],
      structure: enem,
    });

    expect(view).toMatchObject({
      group: FOREIGN,
      leftOut: { examPoints: null, examQuestions: 90, name: FOREIGN, points: null, questions: 5 },
      options: [
        { name: "Língua Inglesa", shortName: "Inglês" },
        { name: "Língua Espanhola", shortName: null },
      ],
      subject: "Língua Espanhola",
    });

    expect(listExamChoiceViews({ choices: [], structure: enem })[0]?.subject).toBeNull();
  });

  it("says an unpicked specialty leaves out its whole test, by the notice's counts and points", () => {
    const cgu = examStructureSchema.parse(reading);

    expect(listExamChoiceViews({ choices: [], structure: cgu })[0]?.leftOut).toStrictEqual({
      examPoints: 360,
      examQuestions: 170,
      name: "Conhecimentos específicos (P3)",
      points: 180,
      questions: 90,
    });

    expect(listUnpickedLeftOut({ choices: [], structure: cgu })).toStrictEqual([
      "Conhecimentos específicos (P3)",
    ]);
  });
});
