import { type TestCase } from "@/lib/types";
import { type FindTargetCutoffParams } from "@zoonk/ai/tasks/v2/research/find-target-cutoff";
import { type FindTargetCutoffExpected } from "./task";

type FindTargetCutoffCase = TestCase<FindTargetCutoffExpected, FindTargetCutoffParams>;

const TODAY = "2026-10-07";

/**
 * SISU publishes every course's cut-off, so medicine at UFMG has one (high on ENEM's 1000 scale);
 * a made-up institution has none, and then "unknown" is the only right answer. A civil service exam's
 * position gets its last edition's cut-off when results or the press published it.
 */
export const TEST_CASES: FindTargetCutoffCase[] = [
  {
    expected: { range: { max: 900, min: 700 } },
    id: "pt-enem-medicina-ufmg",
    userInput: {
      course: "Medicina",
      exam: "ENEM",
      institution: "UFMG",
      position: null,
      today: TODAY,
    },
  },
  {
    expected: { range: { max: 900, min: 550 } },
    id: "pt-enem-direito-ufpe",
    userInput: {
      course: "Direito",
      exam: "ENEM",
      institution: "UFPE",
      position: null,
      today: TODAY,
    },
  },
  {
    expected: { range: null },
    id: "pt-enem-instituicao-inexistente",
    userInput: {
      course: "Direito",
      exam: "ENEM",
      institution: "Faculdade Imaginária de Estudos Avançados de Pirapora do Norte",
      position: null,
      today: TODAY,
    },
  },
  {
    // Cebraspe's net score for the 2021 edition's 120 items, for the national general list.
    expected: { range: { max: 120, min: 40 } },
    id: "pt-concurso-pf-agente",
    userInput: {
      course: null,
      exam: "Concurso Polícia Federal, Agente de Polícia Federal",
      institution: null,
      position: "Agente de Polícia Federal",
      today: TODAY,
    },
  },
  {
    // The 2024 edition's last cut-off was 7.0 on the objective test's 0 to 10 scale. The stored
    // lookup (10 Oct 2026) gave no scale, and the exam page said "Last cut-off: 7".
    expected: { maxScore: 10, range: { max: 10, min: 5 } },
    id: "pt-concurso-tjsp-escrevente",
    userInput: {
      course: null,
      exam: "Concurso TJ-SP, Escrevente Técnico Judiciário",
      institution: null,
      position: "Escrevente Técnico Judiciário",
      today: TODAY,
    },
  },
  {
    expected: { range: null },
    id: "en-position-made-up-exam",
    userInput: {
      course: null,
      exam: "Northern Plains Civil Service Exam, Junior Records Officer",
      institution: null,
      position: "Junior Records Officer",
      today: TODAY,
    },
  },
];
