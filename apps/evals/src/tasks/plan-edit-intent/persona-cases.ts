import { SEED_LEARNERS_TODAY, getSeedLearner } from "@/datasets/seed-learners";
import { type TestCase } from "@/lib/types";
import { type PlanEditInput } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { type ExpectedChange, type PlanEditExpected } from "./scorer";

const DAYS_PER_WEEK = 7;

/**
 * A request a seed learner might type on their own plan: its areas, time and date as the planner
 * would pass them, on the dataset's fixed Monday (so "next week" starts on 2026-10-05).
 */
function personaCase({
  changes,
  id,
  learnerKey,
  request,
}: {
  changes: ExpectedChange[];
  id: string;
  learnerKey: string;
  request: string;
}): TestCase<PlanEditExpected, PlanEditInput> {
  const { goal, language } = getSeedLearner(learnerKey);

  return {
    expected: { changes },
    id: `${language}-persona-${learnerKey}-${id}`,
    userInput: {
      areas: goal.areas,
      dailyMinutes: goal.dailyMinutes,
      goalKind: goal.kind,
      language,
      request,
      targetDate: goal.targetDate,
      today: SEED_LEARNERS_TODAY,
      weekdayMinutes: Array.from({ length: DAYS_PER_WEEK }, () => goal.dailyMinutes),
    },
  };
}

/** Plan edits on the seed learners' own plans (shared eval dataset), in English and Portuguese. */
export const PERSONA_TEST_CASES: TestCase<PlanEditExpected, PlanEditInput>[] = [
  personaCase({
    changes: [{ date: "2026-10-05", kind: "addLightWeek" }],
    id: "night-shifts-light-week",
    learnerKey: "maya",
    request: "I'm on night shifts all next week, can you go easy on me?",
  }),
  personaCase({
    changes: [{ areas: ["The math physics uses"], kind: "focusAreas" }],
    id: "focus-math",
    learnerKey: "maya",
    request: "I want to get the math solid before anything else",
  }),
  personaCase({
    changes: [{ kind: "setDailyMinutes", minutes: 30 }],
    id: "thirty-minutes",
    learnerKey: "maya",
    request: "after a shift I only have 30 minutes in me, make it 30 a day",
  }),
  personaCase({
    changes: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [6] }],
    id: "sem-sabado",
    learnerKey: "ana",
    request: "sábado não dá, tenho cursinho de manhã e chego cansada",
  }),
  personaCase({
    changes: [{ areas: ["Ciências da Natureza"], kind: "focusAreas" }],
    id: "foco-natureza",
    learnerKey: "ana",
    request: "quero dar mais atenção pra Ciências da Natureza, é onde eu vou pior",
  }),
  personaCase({
    changes: [{ date: "2027-05-02", kind: "setTargetDate" }],
    id: "mudanca-adiada",
    learnerKey: "marcos",
    request: "a mudança foi adiada, agora a gente vai dia 2 de maio",
  }),
  personaCase({
    changes: [{ bias: "moreExplanation", kind: "setPracticeBias" }],
    id: "mais-explicacao",
    learnerKey: "lucas",
    request: "quero mais explicação e menos exercício",
  }),
  personaCase({
    changes: [{ areas: ["Investir no longo prazo"], kind: "skipAreas" }],
    id: "pular-longo-prazo",
    learnerKey: "pedro",
    request: "pode tirar a parte de investir no longo prazo, não me interessa agora",
  }),
];
