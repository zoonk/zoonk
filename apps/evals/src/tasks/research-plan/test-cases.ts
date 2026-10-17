import { type TestCase } from "@/lib/types";
import { type ExamResearchPlanParams } from "@zoonk/ai/tasks/v2/research/plan";
import { type ResearchPlanExpected } from "./scorer";

export const TEST_CASES: TestCase<ResearchPlanExpected, ExamResearchPlanParams>[] = [
  {
    expected: {
      country: "BR",
      domains: ["inep.gov.br", "gov.br"],
      language: "pt",
      nameIncludes: ["enem"],
    },
    id: "enem-2026",
    language: "pt",
    userInput: { goal: "quero passar no ENEM desse ano pra enfermagem" },
  },
  {
    expected: {
      country: "BR",
      domains: ["cebraspe.org.br", "tc.df.gov.br"],
      language: "pt",
      nameIncludes: ["tcdf", "tribunal de contas do distrito federal"],
      roleIncludes: "analista",
    },
    id: "tcdf-2026",
    language: "pt",
    userInput: {
      goal: "passar no concurso do TCDF 2026 para analista administrativo de controle externo",
    },
  },
  {
    expected: {
      country: "BR",
      domains: ["oab.fgv.br", "fgv.br"],
      language: "pt",
      nameIncludes: ["oab"],
      roleIncludes: "1",
    },
    id: "oab-first-phase",
    language: "pt",
    userInput: { goal: "vou fazer a primeira fase da oab em março" },
  },
  {
    expected: {
      country: "BR",
      domains: ["oab.fgv.br", "fgv.br"],
      language: "pt",
      nameIncludes: ["oab"],
      roleIncludes: "penal",
    },
    id: "oab-second-phase-area",
    language: "pt",
    userInput: { goal: "passar na segunda fase da OAB em direito penal" },
  },
  {
    expected: {
      country: "US",
      domains: ["collegeboard.org"],
      language: "en",
      nameIncludes: ["sat"],
    },
    id: "sat",
    language: "en",
    userInput: { goal: "Get a 1450 on the SAT in March 2027" },
  },
  {
    expected: {
      country: "DE",
      domains: ["km.bayern.de", "isb.bayern.de", "bayern.de"],
      language: "de",
      nameIncludes: ["abitur"],
    },
    id: "abitur-bayern",
    language: "de",
    userInput: { goal: "Abitur 2027 in Bayern: Mathe und Deutsch schriftlich" },
  },
  {
    expected: {
      country: "FR",
      domains: ["education.gouv.fr", "eduscol.education.gouv.fr"],
      language: "fr",
      nameIncludes: ["bac"],
    },
    id: "bac-2027",
    language: "fr",
    userInput: { goal: "réussir le bac général 2027, philo et spécialités" },
  },
  {
    expected: {
      classTest: true,
      country: "BR",
      domains: [],
      language: "pt",
      nameIncludes: ["biologia"],
    },
    id: "school-biology-test",
    language: "pt",
    userInput: {
      goal: "Tenho prova de biologia na sexta sobre essa aula, me ajuda a estudar pelos slides",
    },
  },
  {
    expected: {
      classTest: true,
      country: "US",
      domains: [],
      language: "en",
      nameIncludes: ["organic chemistry", "midterm"],
    },
    id: "university-midterm",
    language: "en",
    userInput: { goal: "Ace my organic chemistry midterm next Tuesday" },
  },
];
