import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { findMisaccentedPortugueseWord } from "@/lib/portuguese-accents";
import { type TaskScorer } from "@/lib/types";
import {
  type ConversationTurn,
  type WriteConversationFeedbackSchema,
} from "@zoonk/ai/tasks/language/conversation-feedback";
import { normalizeString } from "@zoonk/utils/string";
import { CONVERSATION_FEEDBACK_SCORE_CATEGORIES } from "./score-categories";

const MIN_WORD_COVERAGE = 0.8;
const MAX_PRONUNCIATION_WORDS = 2;
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

function findMisaccentedWord({
  feedback,
  learnerLanguage,
}: {
  feedback: WriteConversationFeedbackSchema;
  learnerLanguage: unknown;
}): string | null {
  if (learnerLanguage !== "pt") {
    return null;
  }

  const learnerLanguageText = [
    feedback.improve?.why,
    ...feedback.pronunciation.map((item) => item.tip),
    feedback.encouragement,
  ].join("\n");

  return findMisaccentedPortugueseWord(learnerLanguageText);
}

function checkFeedback({
  learnerLanguage,
  output,
  turns,
}: {
  learnerLanguage: unknown;
  output: string;
  turns: ConversationTurn[];
}): CodeCheckResult {
  const feedback = JSON.parse(output) as WriteConversationFeedbackSchema;
  const misaccented = findMisaccentedWord({ feedback, learnerLanguage });

  const checks = [
    ...feedback.wentWell.map((phrase) => ({
      passed: wasSaidByLearner({ phrase, turns }),
      problem: `"Went well" phrase "${phrase}" isn't in the learner's turns.`,
    })),
    {
      passed: !feedback.improve || wasSaidByLearner({ phrase: feedback.improve.said, turns }),
      problem: `The fix quotes "${feedback.improve?.said}", which the learner didn't say.`,
    },
    {
      passed: feedback.pronunciation.length <= MAX_PRONUNCIATION_WORDS,
      problem: `It lists ${feedback.pronunciation.length} pronunciation words instead of at most ${MAX_PRONUNCIATION_WORDS}.`,
    },
    ...feedback.pronunciation.map((item) => ({
      passed: wasSaidByLearner({ phrase: item.word, turns }),
      problem: `Pronunciation word "${item.word}" isn't in the learner's turns.`,
    })),
    { passed: !output.includes(EM_DASH), problem: "The feedback uses an em dash." },
    { passed: !misaccented, problem: `"${misaccented}" is written without its accent.` },
  ];

  return {
    judgedOutput: output,
    passed: checks.filter((check) => check.passed).length,
    problems: checks.filter((check) => !check.passed).map((check) => check.problem),
    total: checks.length,
  };
}

function getTurns(userInput: Record<string, unknown>): ConversationTurn[] {
  if (!Array.isArray(userInput.turns)) {
    throw new TypeError("Conversation feedback test cases require turns.");
  }

  return userInput.turns as ConversationTurn[];
}

export const scoreConversationFeedback: TaskScorer = ({ output, testCase }) => {
  const turns = getTurns(testCase.userInput);

  return scoreWithCodeChecks({
    check: (value) =>
      checkFeedback({ learnerLanguage: testCase.userInput.learnerLanguage, output: value, turns }),
    output,
    scoreCategories: CONVERSATION_FEEDBACK_SCORE_CATEGORIES,
    testCase,
  });
};
