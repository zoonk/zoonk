import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type GoalKind } from "@zoonk/db";
import { sleep } from "workflow";
import { isRunActiveStep } from "../_shared/is-run-active-step";
import { repeatUntil } from "../_shared/repeat-until";
import { loadGoalCurriculumStep } from "./steps/goal-curriculum-steps";
import { goalProgressStep } from "./steps/goal-progress-step";

const RESEARCH_POLL = "3s";

/**
 * How long a goal's curriculum waits for its research, in polls. Research reads a new exam's
 * notice in a minute or two, so an exam's plan checks for five minutes after it's built (then less
 * often, see `LATE_RESEARCH_POLL`) to be reconciled with the notice, and a class test waits five
 * minutes for the learner's material before its graph. A learn goal's research only adds what the
 * coverage check reads (reference syllabi, a law's text, a product's docs) or the learner's
 * material, usually within a minute of the learner's answers, so it waits up to two.
 */
const MAX_RESEARCH_POLLS: Partial<Record<GoalKind, number>> = { exam: 100, learn: 40 };

/**
 * Purpose, role and level change the skill graph, so a goal typed in onboarding waits for them:
 * usually a few seconds, since they're the first screens. A learner who leaves onboarding gets
 * the curriculum from what they typed after three minutes.
 */
const ANSWERS_POLL = "3s";
const MAX_ANSWERS_POLLS = 60;

/**
 * Reconciling an exam's plan with its notice blocks nothing the learner waits on, so once the
 * usual wait runs out it keeps checking research every half minute for up to half an hour more:
 * reading a long notice can take far longer when the model is slow (on 2026-09-30 the SAT's
 * reading timed out at the gateway three times, five minutes each, before its step retried).
 */
const LATE_RESEARCH_POLL = "30s";
const MAX_LATE_RESEARCH_POLLS = 60;

/** Whether research is still running once the wait ran out. */
function waitForResearch({
  poll = RESEARCH_POLL,
  researchId,
  times,
}: {
  poll?: typeof LATE_RESEARCH_POLL | typeof RESEARCH_POLL;
  researchId: string;
  times: number;
}): Promise<boolean> {
  return repeatUntil({
    done: (active) => !active,
    run: () => isRunActiveStep(researchId),
    times,
    wait: () => sleep(poll),
  });
}

function waitForAnswers(goalId: string): Promise<GoalCurriculumInputs | null> {
  return repeatUntil({
    done: (inputs) => !inputs?.awaitingAnswers || inputs.hasPlanGraph,
    run: () => loadGoalCurriculumStep(goalId),
    times: MAX_ANSWERS_POLLS,
    wait: () => sleep(ANSWERS_POLL),
  });
}

/**
 * The goal as research left it: read once research ends, or once the goal's kind stops waiting
 * for it, with what research linked (an exam's blueprint, references, the learner's material).
 */
export async function loadResearchedInputs({
  inputs,
  late = false,
  researchId,
}: {
  inputs: GoalCurriculumInputs;
  /** Nothing waits on the result (reconciliation): keep waiting for slow research, less often. */
  late?: boolean;
  researchId: string;
}): Promise<GoalCurriculumInputs | null> {
  const times = MAX_RESEARCH_POLLS[inputs.goal.kind];
  const active = times ? await waitForResearch({ researchId, times }) : false;

  if (active && late) {
    await waitForResearch({ poll: LATE_RESEARCH_POLL, researchId, times: MAX_LATE_RESEARCH_POLLS });
  }

  return loadGoalCurriculumStep(inputs.goal.id);
}

/** Waits for research to read the learner's material, saying so for a class test. */
async function waitForMaterial({
  inputs,
  researchId,
}: {
  inputs: GoalCurriculumInputs;
  researchId: string;
}): Promise<GoalCurriculumInputs | null> {
  const entityId = inputs.goal.id;
  const isExam = inputs.goal.kind === "exam";

  if (isExam) {
    await goalProgressStep({ entityId, status: "started", step: "readExamNotice" });
  }

  const researched = await loadResearchedInputs({ inputs, researchId });

  if (isExam) {
    await goalProgressStep({ entityId, status: "completed", step: "readExamNotice" });
  }

  return researched;
}

/**
 * What a goal's curriculum is built from, once it's ready to read, starting from the goal as the
 * run first read it. The learner's answers to the questions that shape the graph come first.
 * Then, for a goal built from the learner's own material, the research started with the goal,
 * which reads it: the material is the curriculum, and it replaces a blueprint the goal was
 * created with (a class test from the teacher's slides, not the exam of the same name). An exam's
 * graph doesn't wait for research: it's written from the blueprint the goal has, or from the exam
 * as onboarding understood it (its name, year and what the learner said), and the plan is
 * reconciled with a new notice once research reads it (`reconcileResearch`). A goal whose plan
 * exists waits for nothing, since nothing is built for it.
 */
export async function waitForGraphInputs({
  initial,
  researchId,
}: {
  initial: GoalCurriculumInputs;
  researchId?: string | null;
}): Promise<GoalCurriculumInputs | null> {
  const inputs = initial.awaitingAnswers ? await waitForAnswers(initial.goal.id) : initial;

  if (!inputs || !researchId || !inputs.hasMaterial || inputs.hasPlanGraph) {
    return inputs;
  }

  return waitForMaterial({ inputs, researchId });
}

/**
 * The references the coverage check reads while the graph is written. A learn goal's research
 * finds them (reference syllabi, a law's text, a product's docs), so they're read once research
 * ends; research usually ends first, and then nothing waits. A goal built from its material read
 * research before its graph, and an exam's plan is checked against what research read once the
 * plan is built, so neither waits here.
 */
export async function loadGoalReferences({
  inputs,
  researchId,
}: {
  inputs: GoalCurriculumInputs;
  researchId?: string | null;
}): Promise<GoalCurriculumInputs["references"]> {
  if (!researchId || inputs.goal.kind !== "learn" || inputs.hasMaterial || inputs.hasPlanGraph) {
    return inputs.references;
  }

  const researched = await loadResearchedInputs({ inputs, researchId });

  return researched?.references ?? inputs.references;
}
