import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";

const citation = { passage: "Língua Estrangeira (Inglês ou Espanhol)", sourceId: "notice" };

export const LANGUAGES = "Linguagens, Códigos e suas Tecnologias";
export const FOREIGN = "Língua Estrangeira";
export const ENGLISH = "Língua Inglesa";
export const SPANISH = "Língua Espanhola";
export const MATH = "Matemática e suas Tecnologias";

const AREA_QUESTIONS = 45;
const LANGUAGE_QUESTIONS = 5;

function subject(name: string, questions: number, extra: object = {}) {
  return { citation, name, questions, topics: [`Leitura: ${name}`], weight: null, ...extra };
}

const option = { choiceGroup: FOREIGN, partOf: LANGUAGES };

export function choiceBlueprintFixture() {
  return examBlueprintFixture({
    language: "pt",
    name: "ENEM",
    structure: {
      formats: [
        { citation, description: "Cinco alternativas", kind: "multipleChoice", options: 5 },
      ],
      mock: null,
      rules: [],
      subjects: [
        subject(LANGUAGES, AREA_QUESTIONS),
        subject(ENGLISH, LANGUAGE_QUESTIONS, { ...option, shortName: "Inglês" }),
        subject(SPANISH, LANGUAGE_QUESTIONS, { ...option, shortName: "Espanhol" }),
        subject(MATH, AREA_QUESTIONS),
      ],
    },
  });
}

export const HISTORY = "Historia";
export const SPANISH_HISTORY = "Historia de España";
export const PHILOSOPHY = "Historia de la Filosofía";
export const FOREIGN_LANGUAGE = "Lengua Extranjera II";
export const FRENCH = "Lengua Extranjera II: francés";
export const ENGLISH_II = "Lengua Extranjera II: inglés";

const PAU_QUESTIONS = 2;
const PAU_DAY_QUESTIONS = 6;
const PAU_DAY_MINUTES = 90;

export function twoChoiceBlueprintFixture() {
  const written = {
    citation,
    questions: PAU_QUESTIONS,
    topics: ["Comentario de texto"],
    weight: null,
  };

  return examBlueprintFixture({
    country: "ES",
    language: "es",
    name: "PAU",
    structure: {
      formats: [
        {
          citation,
          description: "Preguntas de opción múltiple",
          kind: "multipleChoice",
          options: null,
        },
      ],
      mock: {
        adaptive: false,
        citations: [],
        order: null,
        scoring: { description: "", method: "raw" },
        sections: [
          {
            day: 1,
            kind: "objective",
            minutes: PAU_DAY_MINUTES,
            name: "Primer día",
            questions: PAU_DAY_QUESTIONS,
          },
        ],
        timeLimitMinutes: PAU_DAY_MINUTES,
        totalQuestions: PAU_DAY_QUESTIONS,
      },
      rules: [],
      subjects: [
        { ...written, name: "Lengua Castellana y Literatura II" },
        { ...written, choiceGroup: HISTORY, name: SPANISH_HISTORY },
        { ...written, choiceGroup: HISTORY, name: PHILOSOPHY },
        { ...written, choiceGroup: FOREIGN_LANGUAGE, name: ENGLISH_II },
        { ...written, choiceGroup: FOREIGN_LANGUAGE, name: FRENCH },
      ],
    },
  });
}

export const SPECIALTY = "Especialidade";
export const SOFTWARE = "Tecnologia da Informação – Desenvolvimento de Sistemas";

const SHARED_QUESTIONS = 40;
const SPECIALTY_QUESTIONS = 90;

function specialty(name: string, shortName: string, disciplines: string[]) {
  const topicGroups = disciplines.map((discipline) => ({
    name: discipline,
    topics: [`1 ${discipline}`],
  }));

  return {
    choiceGroup: SPECIALTY,
    citation,
    group: "Conhecimentos específicos (P3)",
    name,
    questions: SPECIALTY_QUESTIONS,
    shortName,
    topicGroups,
    topics: topicGroups.flatMap((group) => group.topics),
    weight: null,
  };
}

export function specialtyBlueprintFixture() {
  return examBlueprintFixture({
    language: "pt",
    name: "CGU",
    role: "Auditor Federal de Finanças e Controle",
    structure: {
      formats: [{ citation, description: "Certo ou errado", kind: "trueFalse", options: null }],
      mock: null,
      rules: [],
      subjects: [
        subject("Ética Pública e Responsabilidade Profissional", SHARED_QUESTIONS, {
          group: "Conhecimentos básicos (P1)",
        }),
        subject("Fundamentos de Auditoria Governamental", SHARED_QUESTIONS, {
          group: "Conhecimentos complementares (P2)",
        }),
        specialty("Auditoria", "Auditoria", ["Auditoria Governamental", "Finanças Públicas"]),
        specialty("Tecnologia da Informação – Ciência de Dados", "Ciência de Dados", [
          "Estatística",
          "Aprendizado de Máquina",
        ]),
        specialty("Tecnologia da Informação – Infraestrutura de TI", "Infraestrutura de TI", [
          "Redes",
          "Computação em Nuvem",
        ]),
        specialty(SOFTWARE, "Desenvolvimento de Sistemas", [
          "Engenharia de Software",
          "Arquitetura de Sistemas",
        ]),
      ],
    },
  });
}
