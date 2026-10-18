import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { normalizeString } from "@zoonk/utils/string";
import { type CallTurn, type CallUsage } from "./live-call";
import { LIVE_CONVERSATION_SCORE_CATEGORIES } from "./score-categories";
import { type LiveConversationExpected, type LiveConversationInput } from "./test-cases";

export type LiveConversationOutput = { turns: CallTurn[]; usage: CallUsage | null };

/**
 * The longest sentence the character may say at each level, a little above the instructions'
 * own limits (A1 about 6 words, A2 about 10, B1 about 15), so only a clear miss fails.
 */
const MAX_SENTENCE_WORDS: Partial<Record<string, number>> = { A1: 9, A2: 14, B1: 20 };

/** "One or two sentences" per turn, with room for a greeting or a short aside. */
const MAX_TURN_SENTENCES = 4;

const SENTENCE_END = /(?<=[.!?…])\s+/u;
const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;

function toWords(text: string): string[] {
  return normalizeString(text.replaceAll(PUNCTUATION, " ")).split(" ").filter(Boolean);
}

function toSentences(text: string): string[] {
  return text
    .split(SENTENCE_END)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * The first turn is the opening line. The voice model's transcript of its own speech may differ in a word
 * or two from the text, so most of the line's words must be there.
 */
const OPENING_WORDS_SHARE = 0.8;

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
      problem: `"${label}" was never marked, though the learner achieved it.`,
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

/** An IELTS mock's cue card is its one long turn, as in the real test. */
function withoutCueCard({ input, turns }: { input: LiveConversationInput; turns: CallTurn[] }) {
  if (input.call.kind !== "speakingMock" || input.call.exam !== "ielts") {
    return turns;
  }

  const longest = turns.reduce<CallTurn | null>(
    (current, turn) => (!current || turn.text.length > current.text.length ? turn : current),
    null,
  );

  return turns.filter((turn) => turn !== longest);
}

/**
 * Every turn replies, briefly; below B2 each sentence stays short. A mock keeps the exam's wording
 * at every level (TOEFL's last sentences to repeat run to about 20 words), and its cue card may run
 * long.
 */
function checkTurnLengths({ input, turns }: { input: LiveConversationInput; turns: CallTurn[] }) {
  const maxWords =
    input.call.kind === "speakingMock" ? undefined : MAX_SENTENCE_WORDS[input.call.level];

  const characterTurns = turns.filter((turn) => turn.speaker === "character");
  const shortTurns = withoutCueCard({ input, turns: characterTurns });

  const longTurns = shortTurns.filter((turn) => toSentences(turn.text).length > MAX_TURN_SENTENCES);

  const longSentences = maxWords
    ? shortTurns.flatMap((turn) =>
        toSentences(turn.text).filter((sentence) => toWords(sentence).length > maxWords),
      )
    : [];

  return [
    {
      passed: characterTurns.every((turn) => turn.text.trim().length > 0),
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

/** The call as the judge reads it: who said what, with the objectives marked after each learner turn. */
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
  ];

  return {
    judgedOutput: formatTranscript(turns),
    passed: checks.filter((check) => check.passed).length,
    problems: checks.filter((check) => !check.passed).map((check) => check.problem),
    total: checks.length,
  };
}

/**
 * Code checks the call's shape (the opening line, every objective the learner achieved marked
 * once and nothing else, short replies at the learner's level), then a judge reads the
 * transcript for role, level and when objectives were marked. Learner lines are what the voice
 * model heard from the text-to-speech voice.
 */
export const scoreLiveConversation: TaskScorer<LiveConversationExpected> = ({
  output,
  testCase,
}) => {
  const input = testCase.userInput as LiveConversationInput;
  const expected = testCase.expected;

  if (!expected) {
    throw new Error(`Live conversation case ${testCase.id} needs its expected objectives.`);
  }

  return scoreWithCodeChecks({
    check: (text) => checkCall({ expected, input, output: text }),
    output,
    scoreCategories: LIVE_CONVERSATION_SCORE_CATEGORIES,
    testCase,
  });
};
