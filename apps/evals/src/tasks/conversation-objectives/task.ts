import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type CheckConversationObjectivesSchema,
  checkConversationObjectives,
} from "@zoonk/ai/tasks/language/conversation-objectives";
import {
  type ConversationObjectivesExpected,
  type ConversationObjectivesInput,
  TEST_CASES,
} from "./test-cases";

const EXACT_SCORE = 10;
const MISSED_SCORE = 6;
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

function toGoodbyeLabel(goodbye: boolean): string {
  return goodbye ? " (goodbye)" : "";
}

/** A goodbye that wasn't said hangs up on the learner; a missed one only lets the call run on. */
const scoreConversationObjectives: TaskScorer<ConversationObjectivesExpected> = ({
  output,
  testCase,
}) => {
  const expected = testCase.expected?.met ?? [];
  const expectedGoodbye = testCase.expected?.goodbye ?? false;
  const { goodbye, met } = JSON.parse(output) as CheckConversationObjectivesSchema;
  const labels = [...new Set(met.map((objective) => objective.label))];
  const wrong = labels.filter((label) => !expected.includes(label));
  const missed = expected.filter((label) => !labels.includes(label));

  const score = getScore({
    missed: missed.length + (expectedGoodbye && !goodbye ? 1 : 0),
    wrong: wrong.length + (goodbye && !expectedGoodbye ? 1 : 0),
  });

  const classification = {
    expected: `${toLabel(expected)}${toGoodbyeLabel(expectedGoodbye)}`,
    predicted: `${toLabel(labels)}${toGoodbyeLabel(goodbye)}`,
  };

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
    "Say which of a live call's open objectives the learner's own words achieved so far, and whether its last exchange was a mutual goodbye, from the transcript: code checks both",
  generate: (input) => checkConversationObjectives({ ...input, useFallback: false }),
  id: "conversation-objectives",
  name: "Conversation Objectives",
  score: scoreConversationObjectives,
  testCases: TEST_CASES,
};
