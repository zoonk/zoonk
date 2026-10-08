import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type FindTopicFrequencyParams,
  type TopicFrequencyFinding,
  findTopicFrequency,
} from "@zoonk/ai/tasks/v2/research/find-topic-frequency";
import { TEST_CASES } from "./test-cases";

export type FindTopicFrequencyExpected = {
  /** A subject that must be found: well-known analyses of its past papers exist. */
  found: string[];
  /** Topics every analysis of the past papers shows asked a lot: never rated `low`. */
  notLow: string[];
  /** Topics every analysis shows asked rarely: never rated `high`. */
  notHigh: string[];
};

function parseOutput(output: string): TopicFrequencyFinding | null {
  try {
    return JSON.parse(output) as TopicFrequencyFinding;
  } catch {
    return null;
  }
}

/** Ratings that contradict what every analysis of the exam's past papers says. */
function findContradictions({
  expected,
  found,
}: {
  expected: FindTopicFrequencyExpected;
  found: TopicFrequencyFinding;
}): string[] {
  const rated = found.subjects.flatMap((subject) => subject.topics);

  return rated.flatMap(({ level, topic }) => {
    if (level === "low" && expected.notLow.includes(topic)) {
      return [`${topic} rated low`];
    }

    return level === "high" && expected.notHigh.includes(topic) ? [`${topic} rated high`] : [];
  });
}

/**
 * 10 for ratings with their sources that agree with what every analysis says (or nothing where no
 * source is expected); 8 for a missed source, which only leaves the plan cutting by the graph's
 * weights; 6 for a rating that contradicts the past papers, which would cut what's asked most.
 */
const scoreTopicFrequency: TaskScorer<FindTopicFrequencyExpected> = ({ output, testCase }) => {
  const found = parseOutput(output);
  const expected = testCase.expected;

  if (!found || !expected) {
    return createFixedScore({ conclusion: "No output", score: 6 });
  }

  const contradictions = findContradictions({ expected, found });

  if (contradictions.length > 0) {
    return createFixedScore({ conclusion: contradictions.join("; "), score: 6 });
  }

  const missed = expected.found.filter(
    (name) => !found.subjects.some((subject) => subject.name === name),
  );

  if (missed.length > 0) {
    return createFixedScore({ conclusion: `Missed ${missed.join(", ")}`, score: 8 });
  }

  // A found subject rates the topics every analysis shows asked a lot: leaving one unrated puts
  // it below the ones the source lists, as a whole discipline left out would.
  const rated = new Set(
    found.subjects.flatMap((subject) => subject.topics.map((item) => item.topic)),
  );

  const unrated =
    expected.found.length > 0 ? expected.notLow.filter((topic) => !rated.has(topic)) : [];

  return unrated.length > 0
    ? createFixedScore({ conclusion: `Left unrated: ${unrated.join("; ")}`, score: 8 })
    : createFixedScore({ conclusion: "None", score: 10 });
};

export const findTopicFrequencyTask: Task<
  FindTopicFrequencyParams,
  TopicFrequencyFinding,
  FindTopicFrequencyExpected
> = {
  description:
    "Look up how often an exam's past papers asked each topic of its subjects, with the page that counts or ranks them, or leave a subject out",
  generate: findTopicFrequency,
  id: "find-topic-frequency",
  latencyBudget: { p50: 40, p95: 70 },
  name: "Find Topic Frequency",
  score: scoreTopicFrequency,
  testCases: TEST_CASES,
};
