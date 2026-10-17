import { type SkillGraphParams } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { type CurriculumScope } from "./curriculum-scope";
import { type GoalCurriculumInputs } from "./goal-curriculum-inputs";

type GraphPrompt = Omit<SkillGraphParams, "analytics" | "model" | "reasoning" | "useFallback">;

/**
 * The details shared content reads: choices from fixed lists and what names the exam. Other
 * learners' plans reuse a shared graph's skills and phases, so the learner's own words (their role,
 * their reason, their answers to follow-ups, notes on their level or time) never reach it: a
 * learner's role ("teacher") once named a shared skill "Relate teaching experience to UX
 * work". Neither does what the learner aims for (a score, a course, an institution) or where they
 * start (the exam subjects they know well, which placement reads).
 */
const SHARED_CONTEXT_FIELDS = new Set([
  "examMonth",
  "examName",
  "examYear",
  "field",
  "materialIntent",
  "nativeLanguage",
  "targetPosition",
]);

/**
 * The details shared content may read (`SHARED_CONTEXT_FIELDS`), as JSON; undefined when there
 * are none.
 */
export function toSharedContext(details: Record<string, unknown>): string | undefined {
  const shared = Object.entries(details).filter(([key]) => SHARED_CONTEXT_FIELDS.has(key));
  return shared.length > 0 ? JSON.stringify(Object.fromEntries(shared)) : undefined;
}

/** The exam onboarding understood: its name, with the position its notice has a part for. */
function toUnderstoodExam(details: Record<string, unknown>): string | null {
  const name = typeof details.examName === "string" ? details.examName.trim() : "";
  const position = typeof details.targetPosition === "string" ? details.targetPosition.trim() : "";

  if (!name) {
    return null;
  }

  return position ? `${name}, ${position}` : name;
}

/**
 * The exam a goal prepares for, as shared content names it: the notice research linked (`exams`,
 * its name and role), else the exam onboarding understood (its name and, for a public-service
 * exam, the position whose part of the notice it is), else the goal's title. Built from the exam,
 * never from the learner's words or the general form a model wrote from them, which carried a
 * learner's "750 points for medicine" into a shared graph.
 */
export function toExamIdentity({
  details,
  exams,
  title,
}: {
  details: Record<string, unknown>;
  exams: readonly { name: string }[];
  title: string;
}): string {
  return exams[0]?.name ?? toUnderstoodExam(details) ?? title;
}

type ScopedInputs = Pick<
  GoalCurriculumInputs,
  "examIdentity" | "goal" | "graphPrompt" | "hasMaterial" | "sharedContext" | "startedCourse"
>;

/**
 * An exam whose graph is shared content: it doesn't depend on who asked, so it's written from the
 * exam alone, and once research linked the exam's notice every later learner of it plans from it
 * (`findReusableCurriculum`). A goal built from the learner's material, started from a course,
 * sized to a test days away, or in a private course is written for that learner.
 */
export function isSharedExamGraph({
  inputs,
  scope,
}: {
  inputs: ScopedInputs;
  scope: Pick<CurriculumScope, "ownerId">;
}): boolean {
  return (
    inputs.goal.kind === "exam" &&
    !inputs.hasMaterial &&
    !inputs.startedCourse &&
    !inputs.graphPrompt.lessonBudget &&
    scope.ownerId === null
  );
}

/**
 * The skill graph's and the coverage check's prompt for the curriculum's scope. A private course
 * reads the goal as the learner typed it, what they told onboarding and their material, with the
 * graph's rules for teaching from it (`hasMaterial`). A shared one, whose skills, courses and
 * phases other learners' plans reuse, reads the goal's general form
 * (the scope's `generalGoal`, else its title) and the details from fixed lists or naming the exam
 * (`sharedContext`, see `toSharedContext`): never the learner's own words. An exam's shared graph
 * is the exam's: it reads the exam (`examIdentity`) and its notice, and nothing its first learner
 * said, not even their level, which would decide which basics every later learner gets; each
 * learner's level decides where they start (placement, the plan's level floor) instead.
 */
export function toScopedGraphPrompt({
  inputs,
  scope,
}: {
  inputs: ScopedInputs;
  scope: Pick<CurriculumScope, "generalGoal" | "ownerId">;
}): GraphPrompt {
  if (scope.ownerId) {
    return { ...inputs.graphPrompt, hasMaterial: inputs.hasMaterial };
  }

  if (isSharedExamGraph({ inputs, scope })) {
    return {
      ...inputs.graphPrompt,
      context: undefined,
      goal: inputs.examIdentity ?? inputs.goal.title,
      ownLevel: undefined,
    };
  }

  return {
    ...inputs.graphPrompt,
    context: inputs.sharedContext,
    goal: scope.generalGoal ?? inputs.goal.title,
  };
}
