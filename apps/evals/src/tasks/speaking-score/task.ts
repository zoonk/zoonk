import { type Task } from "@/lib/types";
import { type SpeakingGrade } from "@zoonk/ai/tasks/v2/language/speaking-bands";
import {
  type ScoreSpeakingParams,
  scoreSpeaking,
} from "@zoonk/ai/tasks/v2/language/speaking-score";
import { SPEAKING_SCORE_CATEGORIES } from "./score-categories";
import { type SpeakingScoreExpected, scoreSpeakingOutput } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const speakingScoreTask: Task<ScoreSpeakingParams, SpeakingGrade, SpeakingScoreExpected> = {
  description:
    "Estimate an IELTS or TOEFL iBT speaking mock, or one task of a DELE, DELF, Goethe or Cambridge speaking paper, on the exam's official criteria: bands on each exam's scale checked against labeled transcripts, then a judge for evidence, tips and accent-neutral honesty",
  generate: scoreSpeaking,
  id: "speaking-score",
  name: "Speaking Score",
  score: scoreSpeakingOutput,
  scoreCategories: SPEAKING_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
