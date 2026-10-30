import { startLevelTestBank } from "@/lib/level-test-bank";
import { startListeningSets } from "@/lib/listening-sets";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { startLikelyLessons } from "./goal-lookahead";
import { type GoalRunContext } from "./goal-run-context";
import { writeMockQuestions } from "./mock-question-writes";
import { prepareAlphabetLessonStep } from "./steps/alphabet-lesson-step";
import {
  pickExamFormatSkillsStep,
  prepareExamFormatItemsStep,
} from "./steps/exam-format-items-step";
import {
  listGoalFieldItemTargetsStep,
  prepareFieldItemsStep,
  readGoalField,
} from "./steps/field-items-steps";
import {
  pickFreeResponseSkillsStep,
  prepareFreeResponseItemStep,
} from "./steps/free-response-items-step";
import { pickItemSetTargetsStep, prepareItemSetStep } from "./steps/item-set-step";
import { listMockPrepWritesStep } from "./steps/mock-question-steps";
import { importPastQuestionsStep, listPastQuestionPapersStep } from "./steps/past-questions-step";
import { loadStatuteDrillTargetsStep, prepareStatuteDrillsStep } from "./steps/statute-drills-step";

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
  await Promise.allSettled(targets.map((target) => prepareFieldItemsStep({ ...context, target })));
}

async function prepareFreeResponseItems({
  context,
  inputs,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
}) {
  const skills = inputs.isGuest ? [] : await pickFreeResponseSkillsStep(inputs.goal.id);

  await Promise.allSettled(
    skills.map((skill) => prepareFreeResponseItemStep({ ...context, skill })),
  );
}

async function prepareExamFormatItems({
  context,
  inputs,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
}) {
  const picks = inputs.isGuest ? [] : await pickExamFormatSkillsStep(inputs.goal.id);
  await Promise.allSettled(picks.map((pick) => prepareExamFormatItemsStep({ ...context, pick })));
}

async function prepareItemSets({
  context,
  inputs,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
}) {
  const targets = inputs.isGuest ? [] : await pickItemSetTargetsStep(inputs.goal.id);
  await Promise.allSettled(targets.map((target) => prepareItemSetStep({ ...context, target })));
}

async function prepareStatuteDrills({
  context,
  goalId,
}: {
  context: GoalRunContext;
  goalId: string;
}) {
  const targets = await loadStatuteDrillTargetsStep(goalId);

  await Promise.allSettled(
    targets.map((target) => prepareStatuteDrillsStep({ ...context, target })),
  );
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
  await Promise.allSettled([prepareAlphabetLessonStep({ ...context, goal })]);
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

async function prepareMockQuestions({
  context,
  inputs,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
}) {
  const { goal } = inputs;

  if (inputs.isGuest || goal.kind !== "exam") {
    return;
  }

  await Promise.allSettled([
    listMockPrepWritesStep(goal.id).then((writes) =>
      writeMockQuestions({ ...context, ...writes, goalId: goal.id, later: true }),
    ),
  ]);
}

/** A rebuilt goal's learner is past placement, so only a first build writes their own work. */
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

  // A full mock asks what the bank holds first, so its questions are written once the exam's own
  // formats, sets and past questions are in.
  const bank = Promise.all([
    prepareExamFormatItems({ context, inputs }),
    prepareItemSets({ context, inputs }),
    preparePastQuestions({ context, goalId }),
  ]);

  return Promise.all([
    rebuild ? [] : startLikelyLessons({ context, inputs }),
    rebuild ? null : prepareFieldItems({ context, inputs }),
    rebuild ? null : prepareFreeResponseItems({ context, inputs }),
    bank.then(() => (rebuild ? null : prepareMockQuestions({ context, inputs }))),
    prepareStatuteDrills({ context, goalId }),
    prepareListeningSets({ context, inputs }),
    rebuild ? null : prepareAlphabetLesson({ context, goal: inputs.goal }),
  ]);
}
