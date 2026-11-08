import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { isAwaitingGraphAnswers } from "@zoonk/core/library/curriculum/shared-graph-prompt";
import { type GoalKind } from "@zoonk/db";
import { sleep } from "workflow";
import { isRunActiveStep } from "../_shared/is-run-active-step";
import { repeatUntil } from "../_shared/repeat-until";
import { beginGoalCurriculumStep, loadGoalCurriculumStep } from "./steps/goal-curriculum-steps";
import { goalProgressStep } from "./steps/goal-progress-step";

const RESEARCH_POLL = "3s";

const LEARN_RESEARCH_POLLS = 40;

/** Research reads a new exam's notice in a minute or two, and a learn goal's references within one. */
const MAX_RESEARCH_POLLS: Partial<Record<GoalKind, number>> = {
  exam: 100,
  learn: LEARN_RESEARCH_POLLS,
};

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

async function waitForAnswers({
  goalId,
  scope,
}: {
  goalId: string;
  scope: CurriculumScope;
}): Promise<GoalCurriculumInputs | null> {
  await repeatUntil({
    done: (inputs) => !inputs || !isAwaitingGraphAnswers({ inputs, scope }),
    run: () => loadGoalCurriculumStep(goalId),
    times: MAX_ANSWERS_POLLS,
    wait: () => sleep(ANSWERS_POLL),
  });

  return beginGoalCurriculumStep({ goalId, scope });
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

/**
 * Research records whether the goal is about a product right after deciding it, so the graph can
 * title the product's course; a run that ends without recording it ends the wait too.
 */
async function waitForProductDecision({
  inputs,
  researchId,
}: {
  inputs: GoalCurriculumInputs;
  researchId: string;
}): Promise<GoalCurriculumInputs | null> {
  const { loaded } = await repeatUntil({
    done: (latest) => latest.decided,
    run: async () => {
      const active = await isRunActiveStep(researchId);
      const latest = await loadGoalCurriculumStep(inputs.goal.id);
      return { decided: !active || !latest || latest.productChecked, loaded: latest };
    },
    times: LEARN_RESEARCH_POLLS,
    wait: () => sleep(RESEARCH_POLL),
  });

  return loaded;
}

export async function waitForGraphInputs({
  initial,
  researchId,
  scope,
}: {
  initial: GoalCurriculumInputs;
  researchId?: string | null;
  scope: CurriculumScope;
}): Promise<GoalCurriculumInputs | null> {
  const inputs = await waitForAnswers({ goalId: initial.goal.id, scope });

  if (!inputs || !researchId || inputs.hasPlanGraph) {
    return inputs;
  }

  if (inputs.hasMaterial) {
    return waitForReading({ inputs, researchId });
  }

  if (inputs.goal.kind === "learn" && !inputs.productChecked) {
    return waitForProductDecision({ inputs, researchId });
  }

  return inputs;
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
