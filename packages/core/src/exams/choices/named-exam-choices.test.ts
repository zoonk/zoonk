import { describe, expect, it } from "vitest";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import reading from "./_test-utils/cgu-2026-structure.json";
import { BIOLOGY, CHEMISTRY, EXANI_STRUCTURE, MODULES } from "./_test-utils/choice-blueprint";
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
  return findNamedChoices({
    goal: { details },
    picks: { examChoices: [], examSubjects: [] },
    structure,
  });
}

function read(position: string) {
  return { positionFromReading: position, targetPosition: position };
}

describe(findNamedChoices, () => {
  it("picks the one option the reading's position names in full", () => {
    expect(named(read("Auditor de TI, desenvolvimento de sistemas"))).toStrictEqual([
      { group: SPECIALTY, subjects: [SOFTWARE] },
    ]);

    expect(named(read("Auditor Federal – Auditoria"))).toStrictEqual([
      { group: SPECIALTY, subjects: [AUDIT] },
    ]);
  });

  it("picks from a typed answer only when it is an option's whole name", () => {
    expect(named({ targetPosition: "Desenvolvimento de Sistemas" })).toStrictEqual([
      { group: SPECIALTY, subjects: [SOFTWARE] },
    ]);

    expect(named({ targetNote: "desenvolvimento de sistemas." })).toStrictEqual([
      { group: SPECIALTY, subjects: [SOFTWARE] },
    ]);

    expect(
      named({ followUps: [{ answer: "Inglês", question: "Qual idioma?" }] }, ENEM),
    ).toStrictEqual([{ group: FOREIGN, subjects: ["Língua Inglesa"] }]);
  });

  it("picks the modules only when the learner names as many as candidates take", () => {
    const exani = examStructureSchema.parse(EXANI_STRUCTURE);

    expect(
      named(
        {
          followUps: [
            { answer: "Biología", question: "¿Qué módulos?" },
            { answer: "Química", question: "¿Y el otro?" },
          ],
        },
        exani,
      ),
    ).toStrictEqual([{ group: MODULES, subjects: [BIOLOGY, CHEMISTRY] }]);

    expect(
      named({ followUps: [{ answer: "Biología", question: "¿Qué módulos?" }] }, exani),
    ).toStrictEqual([]);
  });

  it("asks when a typed answer says more than an option, such as a refusal or a doubt", () => {
    expect(named({ targetPosition: "Ainda não sei, mas não quero Auditoria" })).toStrictEqual([]);
    expect(named({ targetPosition: "Possivelmente Auditoria" })).toStrictEqual([]);
    expect(named({ targetNote: "vou fazer a de Desenvolvimento de Sistemas" })).toStrictEqual([]);

    expect(
      named({ followUps: [{ answer: "Auditoria, eu acho", question: "Qual área?" }] }),
    ).toStrictEqual([]);
  });

  it("reads a position the learner edited on the understood screen as typed", () => {
    expect(
      named({ positionFromReading: "Auditor Federal", targetPosition: "Possivelmente Auditoria" }),
    ).toStrictEqual([]);
  });

  it("asks when only a word of an option, or one the options share, is said", () => {
    expect(named(read("preciso estudar os dados do edital"))).toStrictEqual([]);
    expect(named(read("Auditor de TI, desenvolvimento"))).toStrictEqual([]);
    expect(named(read("Analista de Tecnologia da Informação"))).toStrictEqual([]);
    expect(named({ followUps: [{ answer: "de", question: "Qual área?" }] })).toStrictEqual([]);
  });

  it("asks when the learner's words name two options", () => {
    expect(named(read("Auditoria ou Desenvolvimento de Sistemas"))).toStrictEqual([]);
  });

  it("leaves a picked choice and one the learner answered, even with Decide later", () => {
    const details = { targetPosition: "Desenvolvimento de Sistemas" };

    expect(
      findNamedChoices({
        goal: { details },
        picks: { examChoices: [{ group: SPECIALTY, subjects: [AUDIT] }], examSubjects: [] },
        structure: CGU,
      }),
    ).toStrictEqual([]);

    expect(named({ ...details, answered: ["examChoice"] })).toStrictEqual([]);
  });

  it("picks again when the saved option is no longer one the notice offers", () => {
    expect(
      findNamedChoices({
        goal: { details: { targetPosition: "Desenvolvimento de Sistemas" } },
        picks: {
          examChoices: [{ group: SPECIALTY, subjects: ["Controle Interno"] }],
          examSubjects: [],
        },
        structure: CGU,
      }),
    ).toStrictEqual([{ group: SPECIALTY, subjects: [SOFTWARE] }]);
  });
});
