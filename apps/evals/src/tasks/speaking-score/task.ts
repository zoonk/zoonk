import { LEARNER_INSTRUCTIONS } from "@/lib/comparisons/learner-instructions";
import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import { type SpeakingGrade } from "@zoonk/ai/tasks/language/speaking-bands";
import { type ScoreSpeakingParams, scoreSpeaking } from "@zoonk/ai/tasks/language/speaking-score";
import { PLAIN_LANGUAGE_CRITERION, readCriteria } from "../plain-language-criterion";
import { SPEAKING_SCORE_CATEGORIES } from "./score-categories";
import { type SpeakingScoreExpected, checkSpeakingOutput, scoreSpeakingOutput } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const speakingScoreTask: Task<ScoreSpeakingParams, SpeakingGrade, SpeakingScoreExpected> = {
  codeChecks: checkSpeakingOutput,
  criteria: readCriteria(SPEAKING_SCORE_CATEGORIES, PLAIN_LANGUAGE_CRITERION, LEARNER_INSTRUCTIONS),
  description:
    "Estimate an IELTS or TOEFL iBT speaking mock, or one task of a DELE, DELF, Goethe or Cambridge speaking paper, on the exam's official criteria: bands on each exam's scale checked against labeled transcripts, then a judge for evidence, tips and accent-neutral honesty",
  generate: scoreSpeaking,
  id: "speaking-score",
  name: "Speaking score",
  priorities: {
    comparison: {
      criteria: {
        evidence: "counts",
        honesty: "counts",
        learnerInstructions: "disqualifies",
        plainLanguage: "counts",
        tips: "counts",
      },
      preference: "separates",
      trade: COMPARISON_TRADES.private,
      weights: { evidence: 3, honesty: 3 },
    },
    distribution: "private",
    first: "cost",
    reads: "A learner reads their score, evidence and tips after a call",
    reason: "Private: the cheaper model matched the pricier one",
    waits: "A learner waits for the score after the call",
  },
  score: scoreSpeakingOutput,
  scoreCategories: SPEAKING_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
