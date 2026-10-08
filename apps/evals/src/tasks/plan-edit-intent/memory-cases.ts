import { SEED_LEARNERS_TODAY, getSeedFact, getSeedLearner } from "@/datasets/seed-learners";
import { type TestCase } from "@/lib/types";
import { type PlanEditInput } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { type ExpectedChange, type PlanEditExpected } from "./scorer";

type PlanEditTestCase = TestCase<PlanEditExpected, PlanEditInput>;

const DAYS_PER_WEEK = 7;

/** What the planner reads from memory: the learner's goals and routine, nothing else. */
const PLAN_CATEGORIES = new Set(["goals", "routine"]);

/**
 * A seed learner's plan as the planner passes it, with their goals and routine from memory.
 * `requires` names the fact a case depends on, so a changed seed fails loudly.
 */
function seedInput({
  extraFacts = [],
  learnerKey,
  purpose,
  request = "",
  requires,
}: {
  extraFacts?: string[];
  learnerKey: string;
  purpose: "edit" | "routine";
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
    purpose,
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

/**
 * Plan edits and new plans that need what memory holds about the learner's goals and routine:
 * memory fills in what the request leaves open, the request always wins, and a new plan changes
 * only days a fact clearly names.
 */
export const MEMORY_TEST_CASES: PlanEditTestCase[] = [
  memoryCase({
    changes: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [6] }],
    id: "dia-do-cursinho",
    input: seedInput({
      learnerKey: "ana",
      purpose: "edit",
      request: "tira o estudo do dia do cursinho, chego muito cansada",
      requires: "cursinho aos sábados",
    }),
  }),
  memoryCase({
    changes: [{ kind: "setWeekdayMinutes", minutes: 60, weekdays: [6] }],
    id: "pedido-vence-memoria",
    input: seedInput({
      learnerKey: "ana",
      purpose: "edit",
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
      purpose: "edit",
      request: "go easier on my late days",
    }),
  }),
  memoryCase({
    changes: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] }],
    id: "routine-family-sunday",
    input: seedInput({
      extraFacts: ["Never studies on Sundays: it's family day"],
      learnerKey: "maya",
      purpose: "routine",
    }),
  }),
  memoryCase({
    changes: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] }],
    id: "rotina-domingo-igreja",
    input: seedInput({
      extraFacts: ["Não estuda aos domingos, passa o dia na igreja com a família"],
      learnerKey: "lucas",
      purpose: "routine",
    }),
  }),
  memoryCase({
    changes: [],
    id: "routine-time-of-day-only",
    input: seedInput({ learnerKey: "maya", purpose: "routine", requires: "7:30 am" }),
  }),
  // Saturday mornings go to a prep course, so a lighter or free Saturday fits her routine.
  memoryCase({
    changes: [{ kind: "setWeekdayMinutes", minutes: { max: 25, min: 0 }, weekdays: [6] }],
    id: "rotina-cursinho-sabado",
    input: seedInput({ learnerKey: "ana", purpose: "routine", requires: "cursinho aos sábados" }),
  }),
];
