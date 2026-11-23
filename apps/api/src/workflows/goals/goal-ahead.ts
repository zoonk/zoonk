import { startLevelTestBank } from "@/lib/level-test-bank";
import { startListeningSets } from "@/lib/listening-sets";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { writeAlphabetLesson } from "../language/alphabet-lesson";
import { startLikelyLessons } from "./goal-lookahead";
import { type GoalRunContext } from "./goal-run-context";
import {
  pickExamFormatSkillsStep,
  prepareSkillExamFormatItems,
} from "./steps/exam-format-items-step";
import {
  listGoalFieldItemTargetsStep,
  prepareSkillFieldItems,
  readGoalField,
} from "./steps/field-items-steps";
import { pickItemSetTargetsStep, prepareItemSet } from "./steps/item-set-step";
import { importPastQuestionsStep, listPastQuestionPapersStep } from "./steps/past-questions-step";
import { loadStatuteDrillTargetsStep, prepareLawDrills } from "./steps/statute-drills-step";

async function prepareFieldItems({
  context,
  inputs,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
}) {
  const goalId = inputs.goal.id;
  const field = inputs.isGuest ? null : await readGoalField({ ...context, goalId });

  if (!field) {
    return;
  }

  const targets = await listGoalFieldItemTargetsStep({ field, goalId });
  await Promise.allSettled(targets.map((target) => prepareSkillFieldItems({ ...context, target })));
}

async function prepareExamFormatItems({
  context,
  inputs,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
}) {
  const picks = inputs.isGuest ? [] : await pickExamFormatSkillsStep(inputs.goal.id);
  await Promise.allSettled(picks.map((pick) => prepareSkillExamFormatItems({ ...context, pick })));
}

async function prepareItemSets({
  context,
  inputs,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
}) {
  const targets = inputs.isGuest ? [] : await pickItemSetTargetsStep(inputs.goal.id);
  await Promise.allSettled(targets.map((target) => prepareItemSet({ ...context, target })));
}

async function prepareStatuteDrills({
  context,
  goalId,
}: {
  context: GoalRunContext;
  goalId: string;
}) {
  const targets = await loadStatuteDrillTargetsStep(goalId);

  await Promise.allSettled(targets.map((target) => prepareLawDrills({ ...context, target })));
}

async function preparePastQuestions({
  context,
  goalId,
}: {
  context: GoalRunContext;
  goalId: string;
}) {
  const papers = await listPastQuestionPapersStep(goalId);
  await Promise.allSettled(papers.map((target) => importPastQuestionsStep({ ...context, target })));
}

async function prepareAlphabetLesson({
  context,
  goal,
}: {
  context: GoalRunContext;
  goal: GoalCurriculumInputs["goal"];
}) {
  const { targetLanguage } = goal;

  if (goal.kind !== "language" || !targetLanguage) {
    return;
  }

  await Promise.allSettled([
    writeAlphabetLesson({
      ...context,
      learnerLanguage: goal.language,
      targetLanguage,
      userId: goal.userId,
    }),
  ]);
}

export async function startPairLevelTest({
  context,
  goal,
}: {
  context: GoalRunContext;
  goal: GoalCurriculumInputs["goal"];
}) {
  const { targetLanguage } = goal;

  if (goal.kind !== "language" || !targetLanguage) {
    return;
  }

  await Promise.allSettled([
    startLevelTestBank({
      analytics: context.analytics,
      pair: { language: goal.language, targetLanguage },
    }),
  ]);
}

async function prepareListeningSets({
  context,
  inputs,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
}) {
  const { goal } = inputs;

  if (inputs.isGuest || goal.kind !== "exam" || !goal.targetLanguage) {
    return;
  }

  await Promise.allSettled([
    startListeningSets({ analytics: context.analytics, goalId: goal.id, wait: "later" }),
  ]);
}

export function prepareAhead({
  context,
  inputs,
  rebuild,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  rebuild: boolean;
}) {
  const goalId = inputs.goal.id;

  return Promise.all([
    rebuild ? [] : startLikelyLessons({ context, inputs }),
    rebuild ? null : prepareFieldItems({ context, inputs }),
    prepareExamFormatItems({ context, inputs }),
    prepareItemSets({ context, inputs }),
    preparePastQuestions({ context, goalId }),
    prepareStatuteDrills({ context, goalId }),
    prepareListeningSets({ context, inputs }),
    rebuild ? null : prepareAlphabetLesson({ context, goal: inputs.goal }),
  ]);
}
