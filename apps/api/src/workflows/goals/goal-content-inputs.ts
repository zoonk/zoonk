import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type GoalKind } from "@zoonk/db";
import { sleep } from "workflow";
import { isRunActiveStep } from "../_shared/is-run-active-step";
import { repeatUntil } from "../_shared/repeat-until";
import { loadGoalCurriculumStep } from "./steps/goal-curriculum-steps";
import { goalProgressStep } from "./steps/goal-progress-step";

const RESEARCH_POLL = "3s";

/** Research reads a new exam's notice in a minute or two, and a learn goal's references within one. */
const MAX_RESEARCH_POLLS: Partial<Record<GoalKind, number>> = { exam: 100, learn: 40 };

/** Purpose, role and level change the skill graph, so the curriculum waits for the learner's answers. */
const ANSWERS_POLL = "3s";
const MAX_ANSWERS_POLLS = 60;

/** Reconciling blocks nothing the learner waits on, so it keeps checking on slow research longer. */
const LATE_RESEARCH_POLL = "30s";
const MAX_LATE_RESEARCH_POLLS = 60;

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

export function isBuiltBeforeResearch({
  inputs,
  researchId,
}: {
  inputs: GoalCurriculumInputs;
  researchId?: string | null;
}): boolean {
  return Boolean(researchId) && inputs.goal.kind === "exam" && !inputs.hasMaterial;
}

export async function loadResearchedInputs({
  inputs,
  late = false,
  researchId,
}: {
  inputs: GoalCurriculumInputs;
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

async function waitForReading({
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

export async function waitForGraphInputs({
  initial,
  researchId,
}: {
  initial: GoalCurriculumInputs;
  researchId?: string | null;
}): Promise<GoalCurriculumInputs | null> {
  const inputs = initial.awaitingAnswers ? await waitForAnswers(initial.goal.id) : initial;

  if (!inputs || !researchId || inputs.hasPlanGraph || !inputs.hasMaterial) {
    return inputs;
  }

  return waitForReading({ inputs, researchId });
}

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
