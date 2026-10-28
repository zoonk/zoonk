import { type SkillGraphParams } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { type CurriculumScope } from "./curriculum-scope";
import { type GoalCurriculumInputs } from "./goal-curriculum-inputs";

type GraphPrompt = Omit<SkillGraphParams, "analytics" | "model" | "reasoning" | "useFallback">;

/** Learners' free text must never shape content that other learners reuse. */
const SHARED_CONTEXT_FIELDS = new Set([
  "examMonth",
  "examName",
  "examYear",
  "field",
  "materialIntent",
  "nativeLanguage",
  "targetPosition",
]);

export function toSharedContext(details: Record<string, unknown>): string | undefined {
  const shared = Object.entries(details).filter(([key]) => SHARED_CONTEXT_FIELDS.has(key));
  return shared.length > 0 ? JSON.stringify(Object.fromEntries(shared)) : undefined;
}

function toUnderstoodExam(details: Record<string, unknown>): string | null {
  const name = typeof details.examName === "string" ? details.examName.trim() : "";
  const position = typeof details.targetPosition === "string" ? details.targetPosition.trim() : "";

  if (!name) {
    return null;
  }

  return position ? `${name}, ${position}` : name;
}

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
