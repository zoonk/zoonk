import { type TestCase } from "@/lib/types";
import { type FindChoiceOptionsParams } from "@zoonk/ai/tasks/v2/research/find-choice-options";
import { type FindChoiceOptionsExpected } from "./task";

type FindChoiceOptionsCase = TestCase<FindChoiceOptionsExpected, FindChoiceOptionsParams>;

const TODAY = "2026-10-07";

/**
 * Real exams whose notice or page says the questions are multiple choice without always saying
 * how many options: the Enem (A to E) and the OAB's 1ª fase (A to D) publish every paper, so the
 * number is found in their latest editions.
 */
export const TEST_CASES: FindChoiceOptionsCase[] = [
  {
    expected: { options: 5 },
    id: "pt-enem",
    userInput: { board: "Inep", exam: "Enem", today: TODAY },
  },
  {
    expected: { options: 4 },
    id: "pt-oab-1a-fase",
    userInput: { board: "FGV", exam: "OAB Exame de Ordem Unificado, 1ª fase", today: TODAY },
  },
  {
    expected: { options: 5 },
    id: "pt-fuvest-1a-fase",
    userInput: { board: "Fuvest", exam: "Fuvest, 1ª fase", today: TODAY },
  },
];
