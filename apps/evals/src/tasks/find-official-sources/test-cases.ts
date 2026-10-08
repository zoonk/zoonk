import { type TestCase } from "@/lib/types";
import { type FindOfficialSourcesParams } from "@zoonk/ai/tasks/v2/research/find-official-sources";
import { RESEARCH_SEARCH_TOOLS } from "@zoonk/ai/tasks/v2/research/search-tools";
import { type FindOfficialSourcesExpected } from "./task";

type Exam = {
  id: string;
  /** The language of the exam's official documents. */
  language: string;
  plan: FindOfficialSourcesParams["plan"];
  expected: FindOfficialSourcesExpected;
};

/** Real exams with a current edition on 26 Sep 2026, as the research plan would name them. */
const EXAMS: Exam[] = [
  {
    expected: {
      noticeHints: ["2026", "64"],
      officialDomains: ["inep.gov.br", "gov.br", "in.gov.br"],
    },
    id: "enem-2026",
    language: "pt",
    plan: {
      board: "INEP",
      country: "BR",
      edition: "2026",
      name: "ENEM",
      officialDomains: ["gov.br/inep", "enem.inep.gov.br", "download.inep.gov.br"],
      queries: ["edital ENEM 2026 INEP", "Enem 2026 datas de aplicação edital retificação"],
      role: null,
    },
  },
  {
    expected: {
      noticeHints: ["tc_df_26", "2026", "anace"],
      officialDomains: ["cebraspe.org.br", "tc.df.gov.br"],
    },
    id: "tcdf-2026",
    language: "pt",
    plan: {
      board: "Cebraspe",
      country: "BR",
      edition: "2026",
      name: "Concurso TCDF",
      officialDomains: ["cebraspe.org.br", "tc.df.gov.br"],
      queries: [
        "edital TCDF 2026 analista administrativo de controle externo Cebraspe",
        "TCDF 2026 edital retificação",
      ],
      role: "Analista Administrativo de Controle Externo",
    },
  },
  {
    expected: { noticeHints: ["47", "2026"], officialDomains: ["oab.org.br", "fgv.br"] },
    id: "oab-47",
    language: "pt",
    plan: {
      board: "FGV",
      country: "BR",
      edition: "47",
      name: "Exame de Ordem Unificado (OAB)",
      officialDomains: ["examedeordem.oab.org.br", "oab.org.br", "oab.fgv.br"],
      queries: ["edital 47º Exame de Ordem Unificado FGV", "47º Exame de Ordem cronograma 2ª fase"],
      role: null,
    },
  },
  {
    expected: {
      noticeHints: ["structure", "test", "digital"],
      officialDomains: ["collegeboard.org"],
    },
    id: "sat",
    language: "en",
    plan: {
      board: "College Board",
      country: "US",
      edition: "2027",
      name: "SAT",
      officialDomains: ["satsuite.collegeboard.org", "collegeboard.org"],
      queries: ["digital SAT test structure sections time questions", "SAT test dates 2026-27"],
      role: null,
    },
  },
  {
    expected: {
      noticeHints: ["calculus-ab", "exam-dates", "2027"],
      officialDomains: ["collegeboard.org"],
    },
    id: "ap-calculus-ab-2027",
    language: "en",
    plan: {
      board: "College Board",
      country: "US",
      edition: "2027",
      name: "AP Calculus AB",
      officialDomains: ["apstudents.collegeboard.org", "apcentral.collegeboard.org"],
      queries: ["AP Calculus AB exam format sections timing", "2027 AP Exam dates"],
      role: null,
    },
  },
  {
    expected: { noticeHints: ["academic"], officialDomains: ["ielts.org"] },
    id: "ielts-academic",
    language: "en",
    plan: {
      board: "IELTS (British Council, IDP, Cambridge University Press & Assessment)",
      country: "GB",
      edition: null,
      name: "IELTS Academic",
      officialDomains: ["ielts.org"],
      queries: [
        "IELTS Academic test format sections timing",
        "IELTS Academic listening reading questions",
      ],
      role: null,
    },
  },
  {
    expected: { noticeHints: ["content", "structure", "2026"], officialDomains: ["ets.org"] },
    id: "toefl-ibt",
    language: "en",
    plan: {
      board: "ETS",
      country: "US",
      edition: "2026",
      name: "TOEFL iBT",
      officialDomains: ["ets.org"],
      queries: ["TOEFL iBT test content and structure 2026", "TOEFL iBT sections items timing"],
      role: null,
    },
  },
  {
    expected: {
      noticeHints: ["2027", "termine", "pruefung"],
      officialDomains: ["km.bayern.de", "isb.bayern.de"],
    },
    id: "abitur-bayern-2027",
    language: "de",
    plan: {
      board: "Bayerisches Staatsministerium für Unterricht und Kultus",
      country: "DE",
      edition: "2027",
      name: "Abitur Bayern",
      officialDomains: ["km.bayern.de", "isb.bayern.de"],
      queries: ["Abiturprüfung 2027 Termine Bayern", "Abitur Bayern Prüfungsfächer Anforderungen"],
      role: null,
    },
  },
  {
    expected: { noticeHints: ["2027"], officialDomains: ["education.gouv.fr"] },
    id: "bac-2027",
    language: "fr",
    plan: {
      board: "Ministère de l'Éducation nationale",
      country: "FR",
      edition: "2027",
      name: "Baccalauréat général",
      officialDomains: ["education.gouv.fr", "eduscol.education.gouv.fr"],
      queries: ["calendrier baccalauréat 2027 bulletin officiel", "dates des examens 2027 éduscol"],
      role: null,
    },
  },
];

/**
 * Reference syllabi for big learn goals, as the research plan names them (its `research-plan`
 * eval): a university course page or PDF listing the subject's topics counts as found.
 */
const SYLLABI: Exam[] = [
  {
    expected: {
      noticeHints: ["syllabus", "quantum", "8.04", "course"],
      officialDomains: ["edu", "ac.uk"],
    },
    id: "syllabus-quantum-mechanics",
    language: "en",
    plan: {
      board: null,
      country: "US",
      edition: null,
      name: "Quantum Mechanics",
      officialDomains: ["ocw.mit.edu", "physics.harvard.edu", "stanford.edu"],
      queries: [
        "undergraduate quantum mechanics course syllabus topics",
        "mit ocw quantum physics syllabus",
      ],
      role: null,
    },
  },
  {
    expected: {
      noticeHints: ["ementa", "calculo", "cálculo", "programa", "mat"],
      officialDomains: ["usp.br", "unicamp.br", "ufrj.br", "ufmg.br", "unesp.br", "edu.br"],
    },
    id: "syllabus-calculo",
    language: "pt",
    plan: {
      board: null,
      country: "BR",
      edition: null,
      name: "Cálculo Diferencial e Integral",
      officialDomains: ["usp.br", "unicamp.br", "ufrj.br"],
      queries: [
        "ementa calculo diferencial e integral engenharia",
        "programa disciplina calculo 1 engenharia universidade",
      ],
      role: null,
    },
  },
];

/**
 * Every exam with every search tool. The model's own search comes first in each
 * exam, so `--limit 5` samples it for models compared on built-in search. Syllabi
 * run with the production tool only.
 */
export const TEST_CASES: TestCase<FindOfficialSourcesExpected, FindOfficialSourcesParams>[] = [
  ...EXAMS.flatMap((exam) =>
    ["native", ...RESEARCH_SEARCH_TOOLS.filter((tool) => tool !== "native")].map((searchTool) => ({
      expected: exam.expected,
      id: `${exam.id}:${searchTool}`,
      language: exam.language,
      userInput: {
        plan: exam.plan,
        searchTool: searchTool as FindOfficialSourcesParams["searchTool"],
        topic: "exam" as const,
      },
    })),
  ),
  ...SYLLABI.map((syllabus) => ({
    expected: syllabus.expected,
    id: `${syllabus.id}:parallel`,
    language: syllabus.language,
    userInput: { plan: syllabus.plan, searchTool: "parallel" as const, topic: "syllabus" as const },
  })),
];
