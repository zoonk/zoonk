import { type Task } from "@/lib/types";
import { type ExamSpeakingGrade } from "@zoonk/ai/tasks/v2/language/exam-speaking-bands";
import {
  type ScoreExamSpeakingParams,
  scoreExamSpeaking,
} from "@zoonk/ai/tasks/v2/language/exam-speaking-score";
import { EXAM_SPEAKING_SCORE_CATEGORIES } from "./score-categories";
import { type ExamSpeakingExpected, scoreExamSpeakingOutput } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const examSpeakingScoreTask: Task<
  ScoreExamSpeakingParams,
  ExamSpeakingGrade,
  ExamSpeakingExpected
> = {
  description:
    "Estimate one task of a DELE, DELF, Goethe or Cambridge speaking paper on the exam's official criteria: bands on each exam's scale checked against labeled transcripts, then a judge for evidence, tips and accent-neutral honesty",
  generate: scoreExamSpeaking,
  id: "exam-speaking-score",
  name: "Exam Speaking Score",
  score: scoreExamSpeakingOutput,
  scoreCategories: EXAM_SPEAKING_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
