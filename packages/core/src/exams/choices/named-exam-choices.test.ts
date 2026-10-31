import { describe, expect, it } from "vitest";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import reading from "./_test-utils/cgu-2026-structure.json";
import { findNamedChoices } from "./named-exam-choices";

const CGU = examStructureSchema.parse(reading);
const SPECIALTY = "Especialidade";
const AUDIT = "Auditoria";
const DATA = "Tecnologia da Informação – Ciência de Dados";
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

function named({
  details = {},
  language = "pt",
  prompt = "Passar no concurso da CGU",
  structure = CGU,
  title = "Passar no concurso da CGU",
}: {
  details?: object;
  language?: string;
  prompt?: string;
  structure?: ExamStructure;
  title?: string;
}) {
  return findNamedChoices({ choices: [], goal: { details, language, prompt, title }, structure });
}

describe(findNamedChoices, () => {
  it("picks the one specialty a word of the learner's is only in", () => {
    expect(
      named({ prompt: "passar no concurso da CGU para TI, desenvolvimento de sistemas" }),
    ).toStrictEqual([{ group: SPECIALTY, subject: SOFTWARE }]);

    expect(named({ details: { targetPosition: "Auditor Federal – Auditoria" } })).toStrictEqual([
      { group: SPECIALTY, subject: AUDIT },
    ]);
  });

  it("reads the position and follow-up answers given in onboarding", () => {
    expect(named({ details: { targetNote: "área de ciência de dados" } })).toStrictEqual([
      { group: SPECIALTY, subject: DATA },
    ]);

    expect(
      named({
        details: { followUps: [{ answer: "Desenvolvimento de Sistemas", question: "Qual área?" }] },
      }),
    ).toStrictEqual([{ group: SPECIALTY, subject: SOFTWARE }]);
  });

  it("never picks an option the learner refuses or isn't sure of", () => {
    expect(named({ prompt: "CGU, não quero Auditoria" })).toStrictEqual([]);
    expect(named({ prompt: "CGU, talvez sistemas" })).toStrictEqual([]);
    expect(named({ language: "en", prompt: "CGU, I don't want Auditoria" })).toStrictEqual([]);
    expect(named({ language: "es", prompt: "CGU, no quiero Auditoria" })).toStrictEqual([]);

    expect(
      named({ details: { targetPosition: "Auditoria" }, prompt: "CGU, não quero Auditoria" }),
    ).toStrictEqual([]);
  });

  it("picks the option the learner names after refusing another", () => {
    expect(
      named({
        details: { targetPosition: "Desenvolvimento de Sistemas" },
        prompt: "Não quero Auditoria",
      }),
    ).toStrictEqual([{ group: SPECIALTY, subject: SOFTWARE }]);
  });

  it("asks when the words name two options, only words the options share, or a subject everyone takes", () => {
    expect(named({ prompt: "CGU auditoria ou desenvolvimento de sistemas" })).toStrictEqual([]);
    expect(named({ prompt: "CGU, tecnologia da informação" })).toStrictEqual([]);
    expect(named({ prompt: "CGU, auditor de TI" })).toStrictEqual([]);

    expect(named({ prompt: "CGU, tenho dificuldade em Auditoria Governamental" })).toStrictEqual(
      [],
    );
  });

  it('reads Portuguese\'s "no" as "in the", and English\'s as a refusal', () => {
    expect(named({ prompt: "Passar no ENEM com inglês", structure: ENEM })).toStrictEqual([
      { group: FOREIGN, subject: "Língua Inglesa" },
    ]);

    expect(
      named({ language: "en", prompt: "Pass the ENEM, no Inglês", structure: ENEM }),
    ).toStrictEqual([]);
  });

  it("leaves a picked choice and one the learner answered, even with Decide later", () => {
    const goal = {
      details: {},
      language: "pt",
      prompt: "CGU, desenvolvimento de sistemas",
      title: "Passar no concurso da CGU",
    };

    expect(
      findNamedChoices({ choices: [{ group: SPECIALTY, subject: AUDIT }], goal, structure: CGU }),
    ).toStrictEqual([]);

    expect(
      findNamedChoices({
        choices: [],
        goal: { ...goal, details: { answered: ["examChoice"] } },
        structure: CGU,
      }),
    ).toStrictEqual([]);
  });

  it("picks again when the saved option is no longer one the notice offers", () => {
    expect(
      findNamedChoices({
        choices: [{ group: SPECIALTY, subject: "Controle Interno" }],
        goal: {
          details: {},
          language: "pt",
          prompt: "CGU, desenvolvimento de sistemas",
          title: "Passar no concurso da CGU",
        },
        structure: CGU,
      }),
    ).toStrictEqual([{ group: SPECIALTY, subject: SOFTWARE }]);
  });
});
