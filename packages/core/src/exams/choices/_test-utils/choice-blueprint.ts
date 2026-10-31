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

export const KOKUGO = "国語";
export const MATH_I_A = "数学Ⅰ，数学A";
export const MATH_II_B_C = "数学Ⅱ，数学B，数学C";
export const FOREIGN_JA = "外国語";
export const ENGLISH_JA = "英語";
export const GERMAN_JA = "ドイツ語";
export const INFORMATICS = "情報Ⅰ";

function commonTestSection(test: { minutes: number; name: string; questions: number }) {
  return { day: 1, kind: "objective" as const, ...test };
}

function commonTestSubject(name: string, test: { questions: number }, extra: object = {}) {
  return subject(name, test.questions, extra);
}

const foreignJa = { choiceGroup: FOREIGN_JA };

export const COMMON_TEST_STRUCTURE = {
  formats: [{ citation, description: "マーク式", kind: "multipleChoice" as const, options: 4 }],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" as const },
    sections: [
      commonTestSection({ minutes: 90, name: KOKUGO, questions: 35 }),
      commonTestSection({ minutes: 70, name: MATH_I_A, questions: 30 }),
      commonTestSection({ minutes: 70, name: MATH_II_B_C, questions: 30 }),
      commonTestSection({ minutes: 80, name: "英語（リーディング）", questions: 50 }),
      commonTestSection({ minutes: 60, name: "英語（リスニング）", questions: 37 }),
      commonTestSection({ minutes: 80, name: GERMAN_JA, questions: 50 }),
      commonTestSection({ minutes: 60, name: INFORMATICS, questions: 30 }),
    ],
    timeLimitMinutes: 510,
    totalQuestions: 262,
  },
  rules: [],
  subjects: [
    commonTestSubject(KOKUGO, { questions: 35 }),
    commonTestSubject(MATH_I_A, { questions: 30 }),
    commonTestSubject(MATH_II_B_C, { questions: 30 }),
    commonTestSubject(ENGLISH_JA, { questions: 87 }, foreignJa),
    commonTestSubject(GERMAN_JA, { questions: 50 }, foreignJa),
    commonTestSubject(INFORMATICS, { questions: 30 }),
  ],
};

export function commonTestBlueprintFixture() {
  return examBlueprintFixture({
    country: "JP",
    language: "ja",
    name: "大学入学共通テスト",
    structure: COMMON_TEST_STRUCTURE,
  });
}

export const MODULES = "Módulos de conocimientos disciplinares";
export const BIOLOGY = "Biología";
export const LAW = "Derecho";
export const ECONOMICS = "Economía";
export const PREMED = "Premedicina";
export const CHEMISTRY = "Química";
export const READING_ES = "Comprensión lectora";

const MODULE_QUESTIONS = 24;
const PREMED_QUESTIONS = 48;
const SKILL_QUESTIONS = 30;

const moduleOption = { choiceGroup: MODULES };

export const EXANI_STRUCTURE = {
  choiceGroups: [{ name: MODULES, take: 2 }],
  formats: [
    { citation, description: "Tres opciones", kind: "multipleChoice" as const, options: 3 },
  ],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" as const },
    sections: [
      { day: 1, kind: "objective" as const, minutes: 270, name: "EXANI-II", questions: 138 },
    ],
    timeLimitMinutes: 270,
    totalQuestions: 138,
  },
  rules: [],
  subjects: [
    subject(BIOLOGY, MODULE_QUESTIONS, moduleOption),
    subject(LAW, MODULE_QUESTIONS, moduleOption),
    subject(ECONOMICS, MODULE_QUESTIONS, moduleOption),
    subject(PREMED, PREMED_QUESTIONS, moduleOption),
    subject(CHEMISTRY, MODULE_QUESTIONS, moduleOption),
    subject(READING_ES, SKILL_QUESTIONS),
    subject("Redacción indirecta", SKILL_QUESTIONS),
    subject("Pensamiento matemático", SKILL_QUESTIONS),
  ],
};

export function moduleBlueprintFixture() {
  return examBlueprintFixture({
    country: "MX",
    language: "es",
    name: "EXANI-II",
    structure: EXANI_STRUCTURE,
  });
}
