import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { toWords } from "@/lib/words";
import { type CallTurn } from "./learner";
import { type LiveConversationInput } from "./run-call";
import {
  LIVE_CONVERSATION_SCORE_CATEGORIES,
  MEMORY_CALL_SCORE_CATEGORIES,
} from "./score-categories";

export type LiveConversationOutput = { seconds: number; turns: CallTurn[] };

/** The objective labels the learner's plan reaches, which the call must mark, and no others. */
export type LiveConversationExpected = { objectivesMet: string[] };

/**
 * The longest sentence the character may say at each level, a little above the instructions'
 * own limits (A1 about 6 words, A2 about 10, B1 about 15), so only a clear miss fails.
 */
const MAX_SENTENCE_WORDS: Partial<Record<string, number>> = { A1: 9, A2: 14, B1: 20 };

/** "One or two sentences" per turn, with room for a greeting or a short aside. */
const MAX_TURN_SENTENCES = 4;

/** GPT-Live's transcript of its own speech may differ in a word or two from the opening line. */
const OPENING_WORDS_SHARE = 0.8;

/** Four words of the note in a row are a quote, not a shared word or name. */
const QUOTE_WORDS = 4;

const SENTENCE_END = /(?<=[.!?…])\s+/u;

function toSentences(text: string): string[] {
  return text
    .split(SENTENCE_END)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function checkOpening({ input, turns }: { input: LiveConversationInput; turns: CallTurn[] }) {
  const opening = toWords(input.call.scenario.openingLine);
  const first = new Set(toWords(turns[0]?.text ?? ""));
  const said = opening.filter((word) => first.has(word)).length;

  return {
    passed: said >= opening.length * OPENING_WORDS_SHARE,
    problem: "The character didn't open with its opening line.",
  };
}

function checkObjectives({
  expected,
  input,
  turns,
}: {
  expected: LiveConversationExpected;
  input: LiveConversationInput;
  turns: CallTurn[];
}) {
  const labels = new Set(input.call.scenario.objectives.map((objective) => objective.label));
  const marked = turns.flatMap((turn) => turn.objectivesMet);

  return [
    ...expected.objectivesMet.map((label) => ({
      passed: marked.includes(label),
      problem: `"${label}" was never marked, though the learner's plan reaches it.`,
    })),
    {
      passed: marked.every((label) => labels.has(label)),
      problem: `Marked a label that isn't an objective: ${marked.filter((label) => !labels.has(label)).join(", ")}.`,
    },
    {
      passed: new Set(marked).size === marked.length,
      problem: "Marked the same objective more than once.",
    },
  ];
}

function checkTurnLengths({ input, turns }: { input: LiveConversationInput; turns: CallTurn[] }) {
  const maxWords = MAX_SENTENCE_WORDS[input.call.level];
  const characterTurns = turns.filter((turn) => turn.speaker === "character");

  const longTurns = characterTurns.filter(
    (turn) => toSentences(turn.text).length > MAX_TURN_SENTENCES,
  );

  const longSentences = maxWords
    ? characterTurns.flatMap((turn) =>
        toSentences(turn.text).filter((sentence) => toWords(sentence).length > maxWords),
      )
    : [];

  return [
    {
      passed: characterTurns.every((turn) => turn.text.length > 0),
      problem: "The character left a turn without a reply.",
    },
    {
      passed: longTurns.length === 0,
      problem: `${longTurns.length} turns have more than ${MAX_TURN_SENTENCES} sentences.`,
    },
    {
      passed: longSentences.length === 0,
      problem: `Sentences too long for ${input.call.level}: ${longSentences.map((sentence) => `"${sentence}"`).join(" ")}`,
    },
  ];
}

function toQuotes(note: string): string[] {
  const words = toWords(note);

  return words
    .slice(0, Math.max(0, words.length - QUOTE_WORDS + 1))
    .map((_, index) => words.slice(index, index + QUOTE_WORDS).join(" "));
}

function checkNoteQuotes({ input, turns }: { input: LiveConversationInput; turns: CallTurn[] }) {
  const quotes = toQuotes(input.call.learnerNote ?? "");

  const quoted = turns
    .filter((turn) => turn.speaker === "character")
    .flatMap((turn) => quotes.filter((quote) => toWords(turn.text).join(" ").includes(quote)));

  return quotes.length === 0
    ? []
    : [
        {
          passed: quoted.length === 0,
          problem: `The character quoted the learner's note: ${quoted.map((quote) => `"${quote}"`).join(", ")}.`,
        },
      ];
}

function formatTranscript(turns: readonly CallTurn[]): string {
  return turns
    .map((turn) => {
      const speaker = turn.speaker === "character" ? "CHARACTER" : "LEARNER";

      const marks =
        turn.objectivesMet.length > 0 ? ` [marked: ${turn.objectivesMet.join(", ")}]` : "";

      return `${speaker}: ${turn.text}${marks}`;
    })
    .join("\n");
}

function checkCall({
  expected,
  input,
  output,
}: {
  expected: LiveConversationExpected;
  input: LiveConversationInput;
  output: string;
}): CodeCheckResult {
  const { turns } = JSON.parse(output) as LiveConversationOutput;

  const checks = [
    checkOpening({ input, turns }),
    ...checkObjectives({ expected, input, turns }),
    ...checkTurnLengths({ input, turns }),
    ...checkNoteQuotes({ input, turns }),
  ];

  return {
    judgedOutput: formatTranscript(turns),
    passed: checks.filter((check) => check.passed).length,
    problems: checks.filter((check) => !check.passed).map((check) => check.problem),
    total: checks.length,
  };
}

/**
 * Code checks the call's shape (the opening line, every objective the learner reached marked once
 * and nothing else, short replies at the learner's level, no quote of the learner's note), then a
 * judge reads the transcript for role, level and objectives, and for how a note was used.
 */
export const scoreLiveConversation: TaskScorer<LiveConversationExpected> = ({
  output,
  testCase,
}) => {
  const input = testCase.userInput as LiveConversationInput;
  const { expected } = testCase;

  if (!expected) {
    throw new Error(`Live conversation case ${testCase.id} needs its expected objectives.`);
  }

  return scoreWithCodeChecks({
    check: (text) => checkCall({ expected, input, output: text }),
    output,
    scoreCategories: input.call.learnerNote
      ? MEMORY_CALL_SCORE_CATEGORIES
      : LIVE_CONVERSATION_SCORE_CATEGORIES,
    testCase,
  });
};
