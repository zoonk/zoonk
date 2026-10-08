import { type TestCase } from "@/lib/types";
import { type ResearchPlanParams } from "@zoonk/ai/tasks/v2/research/plan";
import { type ResearchPlanExpected } from "./task";

export const TEST_CASES: TestCase<ResearchPlanExpected, ResearchPlanParams>[] = [
  {
    expected: {
      country: "BR",
      domains: ["inep.gov.br", "gov.br"],
      language: "pt",
      nameIncludes: ["enem"],
    },
    id: "enem-2026",
    language: "pt",
    userInput: { goal: "quero passar no ENEM desse ano pra enfermagem", topic: "exam" },
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
      topic: "exam",
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
    userInput: { goal: "vou fazer a primeira fase da oab em março", topic: "exam" },
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
    userInput: { goal: "passar na segunda fase da OAB em direito penal", topic: "exam" },
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
    userInput: { goal: "Get a 1450 on the SAT in March 2027", topic: "exam" },
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
    userInput: { goal: "Abitur 2027 in Bayern: Mathe und Deutsch schriftlich", topic: "exam" },
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
    userInput: { goal: "réussir le bac général 2027, philo et spécialités", topic: "exam" },
  },
  {
    expected: {
      country: "BR",
      domains: ["gov.br/receitafederal", "receita"],
      language: "pt",
      nameIncludes: ["imposto de renda", "irpf"],
    },
    id: "irpf-2027",
    language: "pt",
    userInput: { goal: "declarar meu imposto de renda 2027 sozinho", topic: "regulation" },
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
      topic: "exam",
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
    userInput: { goal: "Ace my organic chemistry midterm next Tuesday", topic: "exam" },
  },
  {
    expected: {
      country: "ZZ",
      domains: ["nextjs.org"],
      language: "en",
      nameIncludes: ["next.js", "nextjs"],
    },
    id: "nextjs",
    language: "en",
    userInput: {
      goal: "what's new in the latest Next.js version and how to migrate",
      topic: "software",
    },
  },
  {
    expected: {
      country: "US",
      domains: ["mit.edu", "stanford.edu", "harvard.edu", "berkeley.edu", "caltech.edu", "edx.org"],
      language: "en",
      nameIncludes: ["quantum"],
      noQueries: false,
      otherCountries: ["GB", "ZZ"],
    },
    id: "syllabus-quantum-mechanics",
    language: "en",
    userInput: {
      details: '{"purpose":"deep","level":"basic"}',
      goal: "I want to really understand quantum physics, the way a physics major would",
      topic: "syllabus",
    },
  },
  {
    expected: {
      country: "US",
      domains: ["aacnnursing.org", "ncsbn.org", "nln.org", ".edu"],
      language: "en",
      nameIncludes: ["nursing"],
      noQueries: false,
      otherCountries: ["ZZ"],
    },
    id: "syllabus-career-nursing",
    language: "en",
    userInput: {
      details: '{"purpose":"careerChange","role":"Registered nurse"}',
      goal: "I'm an accountant and want to switch careers into nursing",
      topic: "syllabus",
    },
  },
  {
    expected: {
      country: "ZZ",
      domains: [],
      language: "en",
      nameIncludes: ["minecraft", "redstone"],
      noQueries: true,
    },
    id: "syllabus-none-minecraft",
    language: "en",
    userInput: {
      details: '{"purpose":"deep"}',
      goal: "Get really good at Minecraft redstone builds",
      topic: "syllabus",
    },
  },
  {
    expected: {
      country: "BR",
      domains: ["usp.br", "unicamp.br", "ufrj.br", "ufmg.br", "unesp.br", "gov.br"],
      language: "pt",
      nameIncludes: ["calculo"],
      noQueries: false,
    },
    id: "syllabus-calculo",
    language: "pt",
    userInput: {
      details: '{"purpose":"deep","level":"none"}',
      goal: "quero aprender cálculo de verdade, do jeito que se estuda na faculdade de engenharia",
      topic: "syllabus",
    },
  },
  {
    expected: {
      country: "BR",
      domains: ["usp.br", "unicamp.br", "ufrj.br", "ufmg.br", "fgv.br", "insper.edu.br", "gov.br"],
      language: "pt",
      nameIncludes: ["dados"],
      noQueries: false,
    },
    id: "syllabus-career-dados",
    language: "pt",
    userInput: {
      details: '{"purpose":"careerChange","role":"Analista de dados"}',
      goal: "sou professora e quero mudar de carreira para análise de dados",
      topic: "syllabus",
    },
  },
  {
    expected: {
      country: "BR",
      domains: [],
      language: "pt",
      nameIncludes: ["free fire"],
      noQueries: true,
    },
    id: "syllabus-none-free-fire",
    language: "pt",
    userInput: {
      details: '{"purpose":"deep"}',
      goal: "quero ficar muito bom no Free Fire e subir de patente",
      topic: "syllabus",
    },
  },
];
