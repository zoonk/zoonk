import { createStepStream } from "@/workflows/_shared/stream-status";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type SkillGraphParams,
  type SkillsPart,
} from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { findExamLibrary } from "@zoonk/core/library/curriculum/exam-library-skills";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
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

export async function prepareSkillGraphStep({
  analytics,
  inputs,
  scope,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  inputs: GoalCurriculumInputs;
  scope: CurriculumScope;
  workflowRunId: string;
}) {
  "use step";

  await using stream = createStepStream<GoalStreamStep>();
  await stream.status({ entityId: inputs.goal.id, status: "started", step: "buildSkillGraph" });

  return {
    examBlueprintId:
      inputs.graphPrompt.examBlueprint && isSharedExamGraph({ inputs, scope })
        ? inputs.goal.examBlueprintId
        : null,
    model: getScopeModel(scope),
    params: {
      ...toScopedGraphPrompt({ inputs, scope }),
      analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
      serviceTier: chooseServiceTier({ wait: "learner" }),
    } satisfies GraphCallParams,
  };
}

export async function findGraphLibraryStep({
  courses,
  examBlueprintId,
  scope,
}: {
  courses: readonly { key: string; title: string }[];
  examBlueprintId: string;
  scope: CurriculumScope;
}) {
  "use step";
  return findExamLibrary({ courses, examBlueprintId, scope });
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
