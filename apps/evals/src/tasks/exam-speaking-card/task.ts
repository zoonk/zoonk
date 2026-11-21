import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import {
  type ExamSpeakingCardOutput,
  type GenerateExamSpeakingCardParams,
  generateExamSpeakingCard,
} from "@zoonk/ai/tasks/language/exam-speaking-card";
import { readCriteria } from "../plain-language-criterion";
import { EXAM_SPEAKING_CARD_SCORE_CATEGORIES } from "./score-categories";
import { checkExamSpeakingCardOutput, scoreExamSpeakingCardOutput } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const examSpeakingCardTask: Task<GenerateExamSpeakingCardParams, ExamSpeakingCardOutput> = {
  codeChecks: checkExamSpeakingCardOutput,
  criteria: readCriteria(EXAM_SPEAKING_CARD_SCORE_CATEGORIES),
  description:
    "Write one task card of a DELE, DELF, Goethe or Cambridge speaking paper like the exam's sheet: instructions, prompts, the material (photo scenes, a text or a table), and the script of the examiner or partner the voice model plays",
  generate: generateExamSpeakingCard,
  id: "exam-speaking-card",
  name: "Exam speaking card",
  priorities: {
    comparison: {
      criteria: { examFit: "counts", languages: "counts", material: "counts", script: "counts" },
      preference: "separates",
      trade: COMPARISON_TRADES.private,
    },
    distribution: "private",
    first: "quality",
    reads: "A learner reads the speaking task card",
    reason: "Personal to one try; a cheaper model wrote it in the wrong language",
    waits: "A learner can wait when they start the speaking task",
  },
  score: scoreExamSpeakingCardOutput,
  scoreCategories: EXAM_SPEAKING_CARD_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
