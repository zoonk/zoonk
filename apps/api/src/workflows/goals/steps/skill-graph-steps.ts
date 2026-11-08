import { createStepStream } from "@/workflows/_shared/stream-status";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type SkillGraphParams,
  type SkillsPart,
} from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { trackOnboardingProgress } from "@zoonk/core/analytics/track-onboarding-progress";
import { findExamLibrary } from "@zoonk/core/library/curriculum/exam-library-skills";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type GoalOpeningSkill } from "@zoonk/core/library/curriculum/opening-graph";
import { type CurriculumScope, getScopeModel } from "@zoonk/core/library/curriculum/scope";
import {
  isSharedExamGraph,
  toScopedGraphPrompt,
} from "@zoonk/core/library/curriculum/shared-graph-prompt";
import {
  writeSkillGraphFrame,
  writeSkillGraphSection,
  writeWholeSkillGraph,
} from "@zoonk/core/library/curriculum/write-skill-graph";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { type GoalStreamStep } from "./goal-progress-step";

type GraphCallParams = Omit<SkillGraphParams, "findLibrarySkills" | "onSkillNamed">;

function toFirstSkill(opening: GoalOpeningSkill): GraphCallParams["firstSkill"] {
  const { course, skill } = opening;

  return {
    course: { key: course.key, title: course.title },
    description: skill.description,
    key: skill.key,
    level: skill.level,
    name: skill.name,
  };
}

export async function prepareSkillGraphStep({
  analytics,
  firstSkill,
  inputs,
  scope,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  firstSkill?: GoalOpeningSkill | null;
  inputs: GoalCurriculumInputs;
  scope: CurriculumScope;
  workflowRunId: string;
}) {
  "use step";

  await using stream = createStepStream<GoalStreamStep>();

  trackOnboardingProgress({
    at: Date.now(),
    goalId: inputs.goal.id,
    platform: null,
    stage: "run_step",
    status: "started",
    step: "buildSkillGraph",
  });

  await stream.status({ entityId: inputs.goal.id, status: "started", step: "buildSkillGraph" });

  const examBlueprintId =
    inputs.graphPrompt.examBlueprint && isSharedExamGraph({ inputs, scope })
      ? inputs.goal.examBlueprintId
      : null;

  return {
    examBlueprintId,
    model: getScopeModel(scope),
    params: {
      ...toScopedGraphPrompt({ inputs, scope }),
      analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
      firstSkill: firstSkill && toFirstSkill(firstSkill),
      librarySkills: Boolean(examBlueprintId),
      serviceTier: chooseServiceTier({ wait: "learner" }),
    } satisfies GraphCallParams,
  };
}

export async function findGraphLibraryStep({
  courseIdsByKey,
  examBlueprintId,
  language,
}: {
  courseIdsByKey: Record<string, string>;
  examBlueprintId: string;
  language: string;
}) {
  "use step";
  return findExamLibrary({ courseIdsByKey, examBlueprintId, language });
}

async function streamGraphCall<T>({
  goalId,
  write,
}: {
  goalId: string;
  write: (onSkillNamed: NonNullable<SkillGraphParams["onSkillNamed"]>) => Promise<T>;
}) {
  await using stream = createStepStream<GoalStreamStep>();

  return await write((skillName) =>
    stream.status({ entityId: goalId, skillName, status: "started", step: "buildSkillGraph" }),
  );
}

export async function writeGraphFrameStep({
  goalId,
  params,
}: {
  goalId: string;
  params: GraphCallParams;
}) {
  "use step";

  return streamGraphCall({
    goalId,
    write: (onSkillNamed) => writeSkillGraphFrame({ ...params, onSkillNamed }),
  });
}

export async function writeGraphSectionStep({
  goalId,
  params,
  part,
}: {
  goalId: string;
  params: GraphCallParams;
  part: SkillsPart;
}) {
  "use step";

  return streamGraphCall({
    goalId,
    write: (onSkillNamed) => writeSkillGraphSection({ params: { ...params, onSkillNamed }, part }),
  });
}

export async function writeWholeGraphStep({
  goalId,
  params,
}: {
  goalId: string;
  params: GraphCallParams;
}) {
  "use step";

  return streamGraphCall({
    goalId,
    write: (onSkillNamed) => writeWholeSkillGraph({ ...params, onSkillNamed }),
  });
}
