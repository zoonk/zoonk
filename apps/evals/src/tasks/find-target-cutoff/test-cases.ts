import { type TestCase } from "@/lib/types";
import { type FindTargetCutoffParams } from "@zoonk/ai/tasks/research/find-target-cutoff";
import { type FindTargetCutoffExpected } from "./task";

type FindTargetCutoffCase = TestCase<FindTargetCutoffExpected, FindTargetCutoffParams>;

const TODAY = "2026-10-07";

export const TEST_CASES: FindTargetCutoffCase[] = [
  {
    // UFMG's 2026 first-edition table gives Medicina's open-competition minimum as 818.50 after the
    // regular call and 804.30 after the waiting list; 854.90 is its maximum, not a cut-off.
    expected: { range: { max: 825, min: 800 } },
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
