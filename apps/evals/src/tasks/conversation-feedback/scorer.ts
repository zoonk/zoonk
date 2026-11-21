import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import {
  type ConversationTurn,
  type WriteConversationFeedbackSchema,
} from "@zoonk/ai/tasks/language/conversation-feedback";
import { normalizeString } from "@zoonk/utils/string";
import { CONVERSATION_FEEDBACK_SCORE_CATEGORIES } from "./score-categories";

const MIN_WORD_COVERAGE = 0.8;
const PUNCTUATION = /[^\p{L}\p{N}'\s]/gu;
const EM_DASH = "—";

function toWords(text: string): string[] {
  return normalizeString(text.replaceAll(PUNCTUATION, " ")).split(" ").filter(Boolean);
}

function getWordCoverage({ phrase, turn }: { phrase: string[]; turn: string[] }): number {
  const turnWords = new Set(turn);
  return phrase.filter((word) => turnWords.has(word)).length / Math.max(phrase.length, 1);
}

function wasSaidByLearner({ phrase, turns }: { phrase: string; turns: ConversationTurn[] }) {
  const phraseWords = toWords(phrase);

  const learnerTurns = turns
    .filter((turn) => turn.speaker === "learner")
    .map((turn) => toWords(turn.text));

  return (
    phraseWords.length > 0 &&
    learnerTurns.some(
      (turn) =>
        ` ${turn.join(" ")} `.includes(` ${phraseWords.join(" ")} `) ||
        getWordCoverage({ phrase: phraseWords, turn }) >= MIN_WORD_COVERAGE,
    )
  );
}

function checkFeedback({
  output,
  turns,
}: {
  output: string;
  turns: ConversationTurn[];
}): CodeCheckResult {
  const feedback = JSON.parse(output) as WriteConversationFeedbackSchema;

  const checks = [
    ...feedback.wentWell.map((phrase) => ({
      criterion: "honesty",
      passed: wasSaidByLearner({ phrase, turns }),
      problem: `"Went well" phrase "${phrase}" isn't in the learner's turns.`,
    })),
    {
      criterion: "fix",
      passed: !feedback.improve || wasSaidByLearner({ phrase: feedback.improve.said, turns }),
      problem: `The fix quotes "${feedback.improve?.said}", which the learner didn't say.`,
    },
    ...feedback.pronunciation.map((item) => ({
      criterion: "honesty",
      passed: wasSaidByLearner({ phrase: item.word, turns }),
      problem: `Pronunciation word "${item.word}" isn't in the learner's turns.`,
    })),
    {
      criterion: "language",
      passed: !output.includes(EM_DASH),
      problem: "The feedback uses an em dash.",
    },
  ];

  const failed = checks.filter((check) => !check.passed);

  return {
    criteria: [...new Set(failed.map((check) => check.criterion))],
    judgedOutput: output,
    passed: checks.length - failed.length,
    problems: failed.map((check) => check.problem),
    total: checks.length,
  };
}

function getTurns(userInput: Record<string, unknown>): ConversationTurn[] {
  if (!Array.isArray(userInput.turns)) {
    throw new TypeError("Conversation feedback test cases require turns.");
  }

  return userInput.turns as ConversationTurn[];
}

export const checkConversationFeedbackOutput: TaskCodeChecks = ({ output, testCase }) =>
  checkFeedback({ output, turns: getTurns(testCase.userInput) });

export const scoreConversationFeedback: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkConversationFeedbackOutput({ output: value, testCase }),
    output,
    scoreCategories: CONVERSATION_FEEDBACK_SCORE_CATEGORIES,
    testCase,
  });
