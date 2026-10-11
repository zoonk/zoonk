import { type TestCase } from "@/lib/types";
import { type SourceResearchPlanParams } from "@zoonk/ai/tasks/v2/research/source-plan";
import { type ResearchPlanExpected } from "../research-plan/scorer";

export const TEST_CASES: TestCase<ResearchPlanExpected, SourceResearchPlanParams>[] = [
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
