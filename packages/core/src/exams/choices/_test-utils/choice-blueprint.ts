import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";

const citation = { passage: "Língua Estrangeira (Inglês ou Espanhol)", sourceId: "notice" };

export const LANGUAGES = "Linguagens, Códigos e suas Tecnologias";
export const FOREIGN = "Língua Estrangeira";
export const ENGLISH = "Língua Inglesa";
export const SPANISH = "Língua Espanhola";
export const MATH = "Matemática e suas Tecnologias";

/** ENEM's areas have 45 questions each; the foreign language's 5 are inside the languages area's 45. */
const AREA_QUESTIONS = 45;
const LANGUAGE_QUESTIONS = 5;

function subject(name: string, questions: number, extra: object = {}) {
  return { citation, name, questions, topics: [`Leitura: ${name}`], weight: null, ...extra };
}

const option = { choiceGroup: FOREIGN, partOf: LANGUAGES };

/** An ENEM-like notice whose candidates take English or Spanish, inside the languages area's questions. */
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

/** Each PAU-like subject's questions: a mock day asks one subject of each choice, six in all. */
const PAU_QUESTIONS = 2;
const PAU_DAY_QUESTIONS = 6;
const PAU_DAY_MINUTES = 90;

/**
 * A Spanish university entrance exam (PAU) with two choices, neither inside another subject:
 * Spanish History or History of Philosophy, and one foreign language. Its mock day asks two
 * questions of each subject a candidate takes.
 */
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
