import { startLevelTestBank } from "@/lib/level-test-bank";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { startLikelyLessons } from "./goal-lookahead";
import { type GoalRunContext } from "./goal-run-context";
import { prepareAlphabetLessonStep } from "./steps/alphabet-lesson-step";
import {
  listGoalFieldItemTargetsStep,
  prepareFieldItemsStep,
  readGoalField,
} from "./steps/field-items-steps";
import {
  pickFreeResponseSkillsStep,
  prepareFreeResponseItemStep,
} from "./steps/free-response-items-step";
import { importPastQuestionsStep, listPastQuestionPapersStep } from "./steps/past-questions-step";
import { loadStatuteDrillTargetsStep, prepareStatuteDrillsStep } from "./steps/statute-drills-step";

/**
 * A work or career-change goal's first phase gets practice set in the learner's field while
 * placement runs, reusing questions other learners in that field already have. Guests don't.
 */
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

/**
 * An exam answered partly in writing gets original written questions for its essay block: an AP
 * goal's first skills, graded by rows with their own points like AP's scoring guidelines, or the
 * skills of an exam's written test (a discursive test, a peça técnica). Guests don't.
 */
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

/** Public-service exams drill the letter of the laws among their sources, article by article. */
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

/**
 * An exam whose organizer allows quoting past questions with the source (Enem, Brazilian boards)
 * gets real questions from its past papers, once per paper for every learner of that exam.
 */
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

/**
 * The alphabet lesson is extra: when it can't be written, the goal is still ready and its sessions
 * start with the plan, and the pair's next learner tries again.
 */
async function prepareAlphabetLesson({
  context,
  goal,
}: {
  context: GoalRunContext;
  goal: GoalCurriculumInputs["goal"];
}) {
  await Promise.allSettled([prepareAlphabetLessonStep({ ...context, goal })]);
}

/**
 * A language goal's level test needs its pair's questions: their run starts with the curriculum
 * (onboarding usually started it already, and a second start joins it). It's a run of its own,
 * so a failure there never fails the goal, and the level test can start it again.
 */
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

/**
 * What the learner reaches after placement, written ahead while it runs: the first lessons of
 * the two likeliest starting phases, questions in the learner's field, AP free responses, a
 * public exam's statute drills and past questions, and a non-Latin script's alphabet lesson. A
 * rebuilt goal's learner is past placement, so only a first build writes the learner's own work.
 */
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
    rebuild ? null : prepareFreeResponseItems({ context, inputs }),
    prepareStatuteDrills({ context, goalId }),
    preparePastQuestions({ context, goalId }),
    rebuild ? null : prepareAlphabetLesson({ context, goal: inputs.goal }),
  ]);
}
