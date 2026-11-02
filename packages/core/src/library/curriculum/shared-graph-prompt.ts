import { type SkillGraphParams } from "@zoonk/ai/tasks/curriculum/skill-graph";
import { WORK_FIELDS } from "@zoonk/ai/tasks/items/work-fields";
import { type GoalKind } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { LANGUAGE_CODE_PATTERN, getLanguageName } from "@zoonk/utils/languages";
import { z } from "zod";
import { type CurriculumScope } from "./curriculum-scope";
import { type GoalCurriculumInputs } from "./goal-curriculum-inputs";

type GraphPrompt = Omit<SkillGraphParams, "analytics" | "model" | "reasoning" | "useFallback">;

/**
 * Content other learners reuse may reach providers that train on prompts, so it reads only facts
 * that can't hold a learner's words: a typed or edited answer (a position, a reason, the goal's
 * title) never shapes it, and a value outside its fact's shape is dropped.
 */
const SHARED_FACTS = {
  examMonth: z.int().min(1).max(12),
  examYear: z.int(),
  field: z.enum(WORK_FIELDS),
  materialIntent: z.enum(["exam", "understand"]),
  nativeLanguage: z.string().regex(LANGUAGE_CODE_PATTERN),
};

export function toSharedContext(details: Record<string, unknown>): string | undefined {
  const shared = Object.entries(SHARED_FACTS).flatMap(([key, schema]) => {
    const fact = schema.safeParse(details[key]);
    return fact.success ? [[key, fact.data] as const] : [];
  });

  return shared.length > 0 ? JSON.stringify(Object.fromEntries(shared)) : undefined;
}

/** The exam's notice names it once one is linked; until then, the exam onboarding understood. */
export function toExamIdentity({
  details,
  exams,
}: {
  details: unknown;
  exams: readonly { name: string }[];
}): string | null {
  return exams[0]?.name ?? (getString(details, "examName")?.trim() || null);
}

/** A language goal's content is shared by the language it teaches, named in the learner's. */
export function toLanguageGoal({
  language,
  targetLanguage,
}: {
  language: string;
  targetLanguage: string;
}): string {
  return getLanguageName({ targetLanguage, userLanguage: language });
}

/** What names a built goal's shared content; the learner can rename the goal, so never its title. */
export function toSharedGoalName({
  exams,
  goal,
  language,
}: {
  exams: readonly { name: string }[];
  goal: { details: unknown; kind: GoalKind; targetLanguage: string | null };
  language: string;
}): string | null {
  if (goal.kind === "exam") {
    return toExamIdentity({ details: goal.details, exams });
  }

  return goal.kind === "language" && goal.targetLanguage
    ? toLanguageGoal({ language, targetLanguage: goal.targetLanguage })
    : null;
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

function toSharedGoal({ generalGoal }: Pick<CurriculumScope, "generalGoal">): string {
  if (!generalGoal) {
    throw new Error("A shared scope is named by its general goal, never the learner's title");
  }

  return generalGoal;
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
      goal: inputs.examIdentity ?? toSharedGoal(scope),
      ownLevel: undefined,
    };
  }

  return {
    ...inputs.graphPrompt,
    context: inputs.sharedContext,
    goal: toSharedGoal(scope),
    // A language's level test places each learner, and rewrites their level while this graph is built.
    ...(inputs.goal.kind === "language" && { ownLevel: undefined }),
  };
}
