import { getSeedLearner } from "@/datasets/seed-learners";
import { type TestCase } from "@/lib/types";
import { type MemoryFactText } from "@zoonk/ai/tasks/v2/memory/facts";
import { type MemoryReconcileInput } from "@zoonk/ai/tasks/v2/memory/reconcile";
import { type MemoryReconcileExpected } from "./test-cases";

/**
 * A new fact reconciled against everything a seed learner's memory holds, in its seed order, so
 * labels like "replace_2" point at the seed's second fact.
 */
function personaCase({
  actions,
  id,
  intent = "remember",
  learnerKey,
  newFact,
}: {
  actions: string[];
  id: string;
  intent?: "forget" | "remember";
  learnerKey: string;
  newFact: MemoryFactText;
}): TestCase<MemoryReconcileExpected, MemoryReconcileInput> {
  const learner = getSeedLearner(learnerKey);

  return {
    expected: { actions },
    id: `${learner.language}-persona-${learnerKey}-${id}`,
    userInput: { existing: learner.facts, fact: { ...newFact, intent } },
  };
}

/** New facts about the seed learners (shared eval dataset), in English and Portuguese. */
export const PERSONA_TEST_CASES: TestCase<MemoryReconcileExpected, MemoryReconcileInput>[] = [
  personaCase({
    actions: ["replace_2"],
    id: "replace-day-shifts",
    learnerKey: "maya",
    newFact: { category: "background", statement: "Now works day shifts as a nurse" },
  }),
  personaCase({
    actions: ["ignore"],
    id: "ignore-papers-again",
    learnerKey: "maya",
    newFact: { category: "goals", statement: "Wants to understand papers on quantum computing" },
  }),
  personaCase({
    actions: ["remove_4"],
    id: "remove-worked-examples",
    intent: "forget",
    learnerKey: "maya",
    newFact: { category: "learning", statement: "Needs a worked example before trying alone" },
  }),
  personaCase({
    actions: ["add"],
    id: "add-owns-shares",
    learnerKey: "sam",
    newFact: { category: "context", statement: "Also owns a few shares of one company" },
  }),
  personaCase({
    actions: ["replace_1"],
    id: "replace-two-universities",
    learnerKey: "ana",
    newFact: { category: "goals", statement: "Quer cursar Medicina na UFMG ou na USP" },
  }),
  personaCase({
    actions: ["ignore"],
    id: "ignore-saturday-course",
    learnerKey: "ana",
    newFact: { category: "routine", statement: "Tem cursinho no sábado de manhã" },
  }),
  personaCase({
    actions: ["replace_1"],
    id: "replace-move-date",
    learnerKey: "marcos",
    newFact: { category: "goals", statement: "Vai se mudar para Toronto em maio com a esposa" },
  }),
  personaCase({
    actions: ["remove_2"],
    id: "remove-sci-fi",
    intent: "forget",
    learnerKey: "lucas",
    newFact: { category: "preferences", statement: "Gosta de ficção científica" },
  }),
  personaCase({
    actions: ["add"],
    id: "add-school-year",
    learnerKey: "pedro",
    newFact: { category: "background", statement: "Está no primeiro ano do ensino médio" },
  }),
];
