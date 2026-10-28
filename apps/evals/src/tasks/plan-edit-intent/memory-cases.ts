import { SEED_LEARNERS_TODAY, getSeedFact, getSeedLearner } from "@/datasets/seed-learners";
import { type TestCase } from "@/lib/types";
import { type PlanEditInput } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { type ExpectedChange, type PlanEditExpected } from "./scorer";

type PlanEditTestCase = TestCase<PlanEditExpected, PlanEditInput>;

const DAYS_PER_WEEK = 7;

const PLAN_CATEGORIES = new Set(["goals", "routine"]);

/** Throws if a required seed memory fact is missing. */
export function seedInput({
  extraFacts = [],
  learnerKey,
  request = "",
  requires,
}: {
  extraFacts?: string[];
  learnerKey: string;
  request?: string;
  requires?: string;
}): PlanEditInput {
  const learner = getSeedLearner(learnerKey);
  const { goal } = learner;

  if (requires) {
    getSeedFact({ includes: requires, learner });
  }

  return {
    areas: goal.areas,
    dailyMinutes: goal.dailyMinutes,
    goalKind: goal.kind,
    language: learner.language,
    memory: [
      ...learner.facts
        .filter((fact) => PLAN_CATEGORIES.has(fact.category))
        .map((fact) => fact.statement),
      ...extraFacts,
    ],
    request,
    targetDate: goal.targetDate,
    today: SEED_LEARNERS_TODAY,
    weekdayMinutes: Array.from({ length: DAYS_PER_WEEK }, () => goal.dailyMinutes),
  };
}

function memoryCase({
  changes,
  id,
  input,
}: {
  changes: ExpectedChange[];
  id: string;
  input: PlanEditInput;
}): PlanEditTestCase {
  return { expected: { changes }, id: `${input.language}-memory-${id}`, userInput: input };
}

export const MEMORY_TEST_CASES: PlanEditTestCase[] = [
  memoryCase({
    changes: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [6] }],
    id: "dia-do-cursinho",
    input: seedInput({
      learnerKey: "ana",
      request: "tira o estudo do dia do cursinho, chego muito cansada",
      requires: "cursinho aos sábados",
    }),
  }),
  memoryCase({
    changes: [{ kind: "setWeekdayMinutes", minutes: 60, weekdays: [6] }],
    id: "pedido-vence-memoria",
    input: seedInput({
      learnerKey: "ana",
      request: "quero estudar 60 minutos no sábado agora",
      requires: "cursinho aos sábados",
    }),
  }),
  memoryCase({
    changes: [{ kind: "setWeekdayMinutes", minutes: { max: 25, min: 10 }, weekdays: [2, 4] }],
    id: "late-days",
    input: seedInput({
      extraFacts: ["Works late on Tuesdays and Thursdays"],
      learnerKey: "maya",
      request: "go easier on my late days",
    }),
  }),
];
