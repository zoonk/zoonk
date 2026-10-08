import { type TestCase } from "@/lib/types";
import { type FindExamDateParams } from "@zoonk/ai/tasks/v2/goals/find-exam-date";
import { type FindExamDateExpected } from "./task";

type FindExamDateCase = TestCase<FindExamDateExpected, FindExamDateParams>;

/** A Monday in October 2026, the day the owner typed his goal. */
const TODAY = "2026-10-05";

/**
 * Real exams as learners name them on 5 Oct 2026. Exams with a published notice expect its day
 * and an official source; the rest only expect no day that wasn't read from an official page.
 */
export const TEST_CASES: FindExamDateCase[] = [
  {
    expected: {
      firstDate: "2027-01-17",
      officialDomains: ["cebraspe.org.br", "camara.leg.br"],
      status: "official",
    },
    id: "pt-camara-registro-redacao",
    userInput: {
      exam: "Concurso da Câmara dos Deputados",
      institution: "Câmara dos Deputados",
      language: "pt",
      role: "registro/redação",
      today: TODAY,
      words: null,
      year: 2027,
    },
  },
  {
    expected: {
      firstDate: "2026-11-08",
      officialDomains: ["gov.br", "inep.gov.br"],
      status: "official",
    },
    id: "pt-enem-2026",
    userInput: {
      exam: "ENEM",
      institution: null,
      language: "pt",
      role: null,
      today: TODAY,
      words: null,
      year: 2026,
    },
  },
  {
    expected: { officialDomains: ["cebraspe.org.br", "gov.br", "pf.gov.br"], status: "any" },
    id: "pt-pf-agente",
    userInput: {
      exam: "Concurso da Polícia Federal",
      institution: "Polícia Federal",
      language: "pt",
      role: "agente",
      today: TODAY,
      words: null,
      year: null,
    },
  },
  {
    expected: { month: "2027-03", officialDomains: ["oab.org.br", "fgv.br"], status: "any" },
    id: "pt-oab-first-phase-march",
    userInput: {
      exam: "Exame de Ordem da OAB, primeira fase",
      institution: null,
      language: "pt",
      role: null,
      today: TODAY,
      words: "vou fazer a primeira fase da oab em março",
      year: 2027,
    },
  },
  {
    expected: { officialDomains: ["ielts.org", "britishcouncil.org"], status: "notOfficial" },
    id: "en-ielts-booked",
    userInput: {
      exam: "IELTS Academic",
      institution: null,
      language: "en",
      role: null,
      today: TODAY,
      words: null,
      year: null,
    },
  },
  {
    expected: { month: "2027-02", officialDomains: ["calbar.ca.gov"], status: "official" },
    id: "en-california-bar",
    userInput: {
      exam: "California Bar Exam",
      institution: null,
      language: "en",
      role: null,
      today: TODAY,
      words: null,
      year: 2027,
    },
  },
];
