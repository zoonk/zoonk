import { type Task } from "@/lib/types";
import {
  type ExamSpeakingCardOutput,
  type GenerateExamSpeakingCardParams,
  generateExamSpeakingCard,
} from "@zoonk/ai/tasks/v2/language/exam-speaking-card";
import { EXAM_SPEAKING_CARD_SCORE_CATEGORIES } from "./score-categories";
import { scoreExamSpeakingCardOutput } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const examSpeakingCardTask: Task<GenerateExamSpeakingCardParams, ExamSpeakingCardOutput> = {
  description:
    "Write one task card of a DELE, DELF, Goethe or Cambridge speaking paper like the exam's sheet: instructions, prompts, the material (photo scenes, a text or a table), and the script of the examiner or partner the voice model plays",
  generate: generateExamSpeakingCard,
  id: "exam-speaking-card",
  name: "Exam Speaking Card",
  score: scoreExamSpeakingCardOutput,
  scoreCategories: EXAM_SPEAKING_CARD_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
