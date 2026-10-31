import { describe, expect, it } from "vitest";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import reading from "./_test-utils/cgu-2026-structure.json";
import { findNamedChoices } from "./named-exam-choices";

const CGU = examStructureSchema.parse(reading);
const SPECIALTY = "Especialidade";
const AUDIT = "Auditoria";
const SOFTWARE = "Tecnologia da Informação – Desenvolvimento de Sistemas";

const citation = { passage: "…", sourceId: "notice" };
const FOREIGN = "Língua Estrangeira";

function subject(name: string, extra: object = {}) {
  return { citation, name, questions: 5, topics: [], weight: null, ...extra };
}

const ENEM: ExamStructure = {
  formats: [],
  mock: null,
  rules: [],
  subjects: [
    subject("Linguagens, Códigos e suas Tecnologias"),
    subject("Língua Inglesa", { choiceGroup: FOREIGN, shortName: "Inglês" }),
    subject("Língua Espanhola", { choiceGroup: FOREIGN, shortName: "Espanhol" }),
  ],
};

function named(details: object, structure: ExamStructure = CGU) {
  return findNamedChoices({ choices: [], goal: { details }, structure });
}

describe(findNamedChoices, () => {
  it("picks the one option the learner's stated position names in full", () => {
    expect(named({ targetPosition: "Auditor de TI, desenvolvimento de sistemas" })).toStrictEqual([
      { group: SPECIALTY, subject: SOFTWARE },
    ]);

    expect(named({ targetPosition: "Auditor Federal – Auditoria" })).toStrictEqual([
      { group: SPECIALTY, subject: AUDIT },
    ]);
  });

  it("reads the target and follow-up answers typed in onboarding", () => {
    expect(named({ targetNote: "vou fazer a de Desenvolvimento de Sistemas" })).toStrictEqual([
      { group: SPECIALTY, subject: SOFTWARE },
    ]);

    expect(
      named({ followUps: [{ answer: "Inglês", question: "Qual idioma?" }] }, ENEM),
    ).toStrictEqual([{ group: FOREIGN, subject: "Língua Inglesa" }]);
  });

  it("asks when only a word of an option, or one the options share, is said", () => {
    expect(named({ targetNote: "preciso estudar os dados do edital" })).toStrictEqual([]);
    expect(named({ targetPosition: "Auditor de TI, desenvolvimento" })).toStrictEqual([]);
    expect(named({ targetPosition: "Analista de Tecnologia da Informação" })).toStrictEqual([]);
  });

  it("asks when the learner's words name two options", () => {
    expect(named({ targetPosition: "Auditoria ou Desenvolvimento de Sistemas" })).toStrictEqual([]);
  });

  it("leaves a picked choice and one the learner answered, even with Decide later", () => {
    const details = { targetPosition: "Desenvolvimento de Sistemas" };

    expect(
      findNamedChoices({
        choices: [{ group: SPECIALTY, subject: AUDIT }],
        goal: { details },
        structure: CGU,
      }),
    ).toStrictEqual([]);

    expect(named({ ...details, answered: ["examChoice"] })).toStrictEqual([]);
  });

  it("picks again when the saved option is no longer one the notice offers", () => {
    expect(
      findNamedChoices({
        choices: [{ group: SPECIALTY, subject: "Controle Interno" }],
        goal: { details: { targetPosition: "Desenvolvimento de Sistemas" } },
        structure: CGU,
      }),
    ).toStrictEqual([{ group: SPECIALTY, subject: SOFTWARE }]);
  });
});
