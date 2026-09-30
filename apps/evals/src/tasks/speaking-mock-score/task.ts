import { type Task } from "@/lib/types";
import {
  type ScoreSpeakingMockParams,
  type ScoreSpeakingMockSchema,
  scoreSpeakingMock,
} from "@zoonk/ai/tasks/v2/language/speaking-mock-score";
import { SPEAKING_MOCK_SCORE_CATEGORIES } from "./score-categories";
import { type SpeakingMockExpected, scoreSpeakingMockOutput } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const speakingMockScoreTask: Task<
  ScoreSpeakingMockParams,
  ScoreSpeakingMockSchema,
  SpeakingMockExpected
> = {
  description:
    "Estimate an IELTS or TOEFL iBT speaking mock by its exam's criteria: band ranges checked against labeled transcripts on each exam's scale, then a judge for evidence and tips",
  generate: scoreSpeakingMock,
  id: "speaking-mock-score",
  name: "Speaking Mock Score",
  score: scoreSpeakingMockOutput,
  scoreCategories: SPEAKING_MOCK_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
