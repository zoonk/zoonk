import { type TestCase } from "@/lib/types";
import { type PlanRoutineFitInput } from "@zoonk/ai/tasks/v2/plans/routine-fit";
import { seedInput } from "../plan-edit-intent/memory-cases";
import { type ExpectedChange, type PlanEditExpected } from "../plan-edit-intent/scorer";

type PlanRoutineFitTestCase = TestCase<PlanEditExpected, PlanRoutineFitInput>;

/** A seed learner's new plan with their goals and routine from memory, as the planner fits it. */
function routineCase({
  changes,
  extraFacts,
  id,
  learnerKey,
  requires,
}: {
  changes: ExpectedChange[];
  extraFacts?: string[];
  id: string;
  learnerKey: string;
  requires?: string;
}): PlanRoutineFitTestCase {
  const {
    dailyMinutes,
    language,
    memory = [],
    today,
    weekdayMinutes,
  } = seedInput({ extraFacts, learnerKey, requires });

  return {
    expected: { changes },
    id: `${language}-${id}`,
    userInput: { dailyMinutes, language, memory, today, weekdayMinutes },
  };
}

/**
 * New plans fitted to what memory holds about the learner's routine: only days a fact clearly
 * names and dated weeks that haven't passed change, and a fact that names no day changes nothing.
 * The seed learners' today is Monday, 28 September 2026.
 */
export const TEST_CASES: PlanRoutineFitTestCase[] = [
  routineCase({
    changes: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] }],
    extraFacts: ["Never studies on Sundays: it's family day"],
    id: "routine-family-sunday",
    learnerKey: "maya",
  }),
  routineCase({
    changes: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] }],
    extraFacts: ["Não estuda aos domingos, passa o dia na igreja com a família"],
    id: "rotina-domingo-igreja",
    learnerKey: "lucas",
  }),
  routineCase({
    changes: [],
    id: "routine-time-of-day-only",
    learnerKey: "maya",
    requires: "7:30 am",
  }),
  // Saturday mornings go to a prep course, so a lighter or free Saturday fits her routine.
  routineCase({
    changes: [{ kind: "setWeekdayMinutes", minutes: { max: 25, min: 0 }, weekdays: [6] }],
    id: "rotina-cursinho-sabado",
    learnerKey: "ana",
    requires: "cursinho aos sábados",
  }),
  routineCase({
    changes: [{ date: "2026-10-19", kind: "addLightWeek" }],
    extraFacts: ["Has exams at school the week of October 19"],
    id: "routine-school-exams-week",
    learnerKey: "maya",
  }),
  routineCase({
    changes: [{ date: "2026-10-12", kind: "addLightWeek" }],
    extraFacts: ["Viaja a trabalho na semana que começa em 12 de outubro"],
    id: "rotina-viagem-outubro",
    learnerKey: "lucas",
  }),
];
