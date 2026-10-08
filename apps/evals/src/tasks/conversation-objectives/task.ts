import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type CheckConversationObjectivesSchema,
  checkConversationObjectives,
} from "@zoonk/ai/tasks/v2/language/conversation-objectives";
import {
  type ConversationObjectivesExpected,
  type ConversationObjectivesInput,
  TEST_CASES,
} from "./test-cases";

const EXACT_SCORE = 10;
/** A goal the learner reached shows up after their next turn, so a miss costs less. */
const MISSED_SCORE = 6;
/** Ticking a goal the learner didn't reach gives Brain Power and a checkpoint for nothing. */
const WRONG_MARK_SCORE = 2;

function toLabel(labels: readonly string[]): string {
  return labels.length === 0 ? "none" : labels.toSorted().join(" + ");
}

function getScore({ missed, wrong }: { missed: number; wrong: number }): number {
  if (wrong > 0) {
    return WRONG_MARK_SCORE;
  }

  return missed > 0 ? MISSED_SCORE : EXACT_SCORE;
}

/**
 * Scores the labels against the case's: the same set scores full; marking a goal the learner
 * didn't reach scores lowest, since it pays for nothing; only missing one scores in between.
 */
const scoreConversationObjectives: TaskScorer<ConversationObjectivesExpected> = ({
  output,
  testCase,
}) => {
  const expected = testCase.expected?.met ?? [];
  const { met } = JSON.parse(output) as CheckConversationObjectivesSchema;
  const labels = [...new Set(met.map((objective) => objective.label))];
  const wrong = labels.filter((label) => !expected.includes(label));
  const missed = expected.filter((label) => !labels.includes(label));

  const score = getScore({ missed: missed.length, wrong: wrong.length });
  const classification = { expected: toLabel(expected), predicted: toLabel(labels) };

  return {
    ...createFixedScore({
      conclusion: `Expected ${classification.expected}; marked ${classification.predicted}.`,
      score,
    }),
    classification,
  };
};

export const conversationObjectivesTask: Task<
  ConversationObjectivesInput,
  CheckConversationObjectivesSchema,
  ConversationObjectivesExpected
> = {
  description:
    "Say which of a live call's open objectives the learner's own words achieved so far, from the transcript: code checks the labels",
  generate: (input) => checkConversationObjectives({ ...input, useFallback: false }),
  id: "conversation-objectives",
  name: "Conversation Objectives",
  score: scoreConversationObjectives,
  testCases: TEST_CASES,
};
