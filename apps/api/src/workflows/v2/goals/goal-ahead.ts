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
 * skills of an exam's written test (a discursive test, the OAB's legal brief). Guests don't.
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

/**
 * An exam that asks more than one quick pick (JEE Advanced's "one or more correct options", the
 * SAT's grid-ins) gets questions in those formats for its first skills, so practice asks them the
 * exam's way from the first days. Guests don't.
 */
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

/**
 * An exam goal gets a few question sets (a passage, a case or a chart with several questions on
 * it, as exams group them) on the areas its first days study most, shared with every learner of
 * the exam. Guests don't.
 */
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
 * A language certificate's listening parts each get a recording (a written, voiced set) at the
 * flex tier, in a run of its own: an exam's first learner pays for them, every later one finds
 * them made, and a failure never fails the goal. Guests don't start it.
 */
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

/**
 * The exam's first learner's goal gets its full mocks' questions the shared bank still lacks, in
 * the notice's mix of formats, once the exam's own formats, question sets and past questions are
 * in (`listMockPrepWrites`): their first full mock starts without waiting, and the exam's later
 * learners find them made. At the flex tier, so a failure never fails the goal. Guests don't.
 */
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

/**
 * What the learner reaches after placement, written ahead while it runs: the first lessons of
 * the two likeliest starting phases, questions in the learner's field, AP free responses, an
 * exam's own answer formats and question sets, a public exam's statute drills and past
 * questions, then its first full mocks' questions, a language certificate's listening recordings
 * and a non-Latin script's alphabet lesson. A rebuilt goal's learner is past placement, so only a first build writes the learner's
 * own work.
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
