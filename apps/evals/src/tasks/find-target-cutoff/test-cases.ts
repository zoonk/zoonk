import { type TestCase } from "@/lib/types";
import { type FindTargetCutoffParams } from "@zoonk/ai/tasks/v2/research/find-target-cutoff";
import { type FindTargetCutoffExpected } from "./task";

type FindTargetCutoffCase = TestCase<FindTargetCutoffExpected, FindTargetCutoffParams>;

const TODAY = "2026-10-07";

/**
 * SISU publishes every course's cut-off, so Medicina at UFMG has one (high on ENEM's 1000 scale);
 * a made-up institution has none, and then "unknown" is the only right answer. A concurso's
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
];
