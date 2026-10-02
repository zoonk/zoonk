import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { type MemoryInsightParams, generateMemoryInsight } from "@zoonk/ai/tasks/v2/memory/insight";
import {
  type MemoryInsightOutput,
  memoryInsightOutputSchema,
  toMemoryInsight,
} from "@zoonk/ai/tasks/v2/memory/insight-rules";
import { normalizeString } from "@zoonk/utils/string";
import { type MemoryInsightExpected, TEST_CASES } from "./test-cases";

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

/** Promises about results, in the two eval languages: never allowed in learner-facing copy. */
const PROMISE_WORDS = ["guarantee", "you will pass", "garant", "vai passar", "aprovad"];

function getOutput(output: string): MemoryInsightOutput | null {
  try {
    const parsed = memoryInsightOutputSchema.safeParse(JSON.parse(output));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function containsAny(text: string, words: readonly string[]): boolean {
  const normalized = normalizeString(text);
  return words.some((word) => normalized.includes(normalizeString(word)));
}

function getHour(time: string | null): number | null {
  return time ? Number(time.slice(0, 2)) : null;
}

/** A plan change says its size the way the input gave it, never smaller or bigger. */
function saysSize({
  expected,
  message,
}: {
  expected: MemoryInsightExpected;
  message: string;
}): boolean {
  const named = !expected.sizeWords || containsAny(message, expected.sizeWords);
  const misstated = expected.wrongSizeWords && containsAny(message, expected.wrongSizeWords);

  return named && !misstated;
}

/** The checks that apply once the kind is right: what production would show, and how it reads. */
function checkMessage({
  expected,
  insight,
  output,
}: {
  expected: MemoryInsightExpected;
  insight: NonNullable<ReturnType<typeof toMemoryInsight>>;
  output: MemoryInsightOutput;
}): string[] {
  const hour = getHour(output.studyTime);
  const [fromHour, toHour] = expected.studyHours ?? [];

  return [
    expected.mentions && !containsAny(insight.message, expected.mentions)
      ? `The message doesn't mention ${expected.mentions.join("/")}.`
      : null,
    expected.languageWords && !containsAny(insight.message, expected.languageWords)
      ? "The message isn't in the learner's language."
      : null,
    containsAny(insight.message, PROMISE_WORDS) ? "The message promises a result." : null,
    insight.message.includes("!") ? "The message uses an exclamation mark." : null,
    fromHour !== undefined && (hour === null || hour < fromHour || hour > (toHour ?? fromHour))
      ? `Suggested ${output.studyTime}, outside ${fromHour}:00-${toHour}:59.`
      : null,
    expected.skill !== undefined && output.skill !== expected.skill
      ? `Picked skill ${output.skill}, not ${expected.skill}.`
      : null,
    saysSize({ expected, message: insight.message })
      ? null
      : "The message doesn't say the plan change's real size.",
  ].filter((problem): problem is string => problem !== null);
}

/**
 * Code-checked: the kind must be one the signals call for (usually `none`), and a shown insight
 * must pass production's checks, mention what the signals point at, say a plan change's real size
 * (a lesson, a few or a chapter), stay in the learner's language, and never promise a result.
 */
const scoreMemoryInsight: TaskScorer<MemoryInsightExpected> = ({ output, testCase }) => {
  const parsed = getOutput(output);
  const expected = testCase.expected;
  const input = testCase.userInput as MemoryInsightParams;

  if (!parsed || !expected) {
    return createFixedScore({ conclusion: "Output didn't match the schema.", score: MIN_SCORE });
  }

  const classification = { expected: expected.kinds[0] ?? "none", predicted: parsed.kind };

  if (!expected.kinds.includes(parsed.kind)) {
    const conclusion = `Expected ${expected.kinds.join(" or ")}; got ${parsed.kind}.`;
    return { ...createFixedScore({ conclusion, score: MIN_SCORE }), classification };
  }

  if (parsed.kind === "none") {
    return { ...createFixedScore({ conclusion: "None", score: 10 }), classification };
  }

  const insight = toMemoryInsight({
    context: { kinds: input.kinds, skillCount: input.skills.length, studyTime: input.studyTime },
    output: parsed,
  });

  if (!insight) {
    const conclusion = "Production would drop this insight: a field is missing or invalid.";
    return { ...createFixedScore({ conclusion, score: 7 }), classification };
  }

  const problems = checkMessage({ expected, insight, output: parsed });
  const checks = 6;
  const score = MIN_SCORE + (SCORE_RANGE * (checks - Math.min(problems.length, checks))) / checks;

  return {
    ...createFixedScore({ conclusion: problems.join(" ") || "None", score }),
    classification,
  };
};

export const memoryInsightTask: Task<
  MemoryInsightParams,
  MemoryInsightOutput,
  MemoryInsightExpected
> = {
  description:
    "Turn a week of answers, mistakes and study times into at most one tip, plan change or schedule idea",
  generate: generateMemoryInsight,
  id: "memory-insight",
  name: "Memory Insight",
  score: scoreMemoryInsight,
  testCases: TEST_CASES,
};
