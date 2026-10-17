import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectShare } from "./exam-map";

const citation = { passage: "…", sourceId: "notice" };
const LANGUAGES = "Linguagens, Códigos e suas Tecnologias";

function subject(name: string, questions: number, extra: object = {}) {
  return { citation, name, questions, topics: [], weight: null, ...extra };
}

const option = { choiceGroup: "Língua Estrangeira", partOf: LANGUAGES };

const enem: ExamStructure = {
  formats: [],
  mock: null,
  rules: [],
  subjects: [
    subject(LANGUAGES, 45),
    subject("Língua Inglesa", 5, option),
    subject("Língua Espanhola", 5, option),
    subject("Matemática e suas Tecnologias", 45),
  ],
};

describe(getSubjectShare, () => {
  it("shares the exam's questions counting each question once, a choice's options included", () => {
    const shares = enem.subjects.map((item) => getSubjectShare({ structure: enem, subject: item }));
    expect(shares).toStrictEqual([0.5, 5 / 90, 5 / 90, 0.5]);
  });
});
