import { type ExamResearchPlan } from "@zoonk/ai/tasks/v2/research/plan";
import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import { getWorkflowMetadata } from "workflow";
import { type Run, start } from "workflow/api";
import { claimRunToken, joinRun } from "../_shared/run-token";
import { scheduleFreshnessChecksStep } from "../freshness/steps/schedule-freshness-checks-step";
import { goalContentWorkflow } from "../goals/goal-content-workflow";
import { type ResearchAnalytics, toResearchAnalytics } from "./_utils/research-analytics";
import { describeExam, readExamBlueprint } from "./read-exam-blueprint";
import { type ResearchResult, researchResultSchema } from "./research-result";
import { type ResearchContext, findAndStoreSources, researchSources } from "./research-sources";
import { detectResearchTopic } from "./research-topic";
import { lookUpChoiceOptionsStep } from "./steps/choice-options-step";
import { lookUpCourseWeightsStep } from "./steps/course-weights-step";
import { findExamBlueprintStep } from "./steps/find-exam-blueprint-step";
import { hasPrivateUploadsStep } from "./steps/inspect-uploads-step";
import { linkGoalToBlueprintStep, unlinkGoalFromSharedExamStep } from "./steps/link-goal-step";
import { type ResearchGoal, loadResearchGoalStep } from "./steps/load-research-goal-step";
import { recordNoticeFormatsStep } from "./steps/notice-formats-step";
import { planExamResearchStep, planSourceResearchStep } from "./steps/plan-research-step";
import { recordResearchOutcomeStep } from "./steps/record-research-outcome-step";
import { recordResearchRunStep } from "./steps/record-research-run-step";
import { lookUpSubjectQuestionsStep } from "./steps/subject-questions-step";
import { lookUpTargetCutoffStep } from "./steps/target-cutoff-step";
import { lookUpTopicFrequencyStep } from "./steps/topic-frequency-step";

export type ResearchInput = {
  goalId: string;
  /** When absent or empty, research reads the material the learner uploaded with the goal. */
  sourceIds?: string[];
};

async function finishExam({
  analytics,
  examBlueprintId,
  goal,
  isShared,
}: {
  analytics: ResearchAnalytics;
  examBlueprintId: string;
  goal: ResearchGoal;
  isShared: boolean;
}): Promise<ResearchResult> {
  await linkGoalToBlueprintStep({ examBlueprintId, goalId: goal.id });

  // The lookups only add to the notice and the plan, so one that fails is left to the next research.
  if (isShared) {
    await Promise.all([
      Promise.allSettled([
        lookUpChoiceOptionsStep({ analytics, examBlueprintId }),
        lookUpSubjectQuestionsStep({ analytics, examBlueprintId }),
        lookUpTopicFrequencyStep({ analytics, examBlueprintId }),
        lookUpCourseWeightsStep({ analytics, goalId: goal.id }),
        lookUpTargetCutoffStep({ analytics, goalId: goal.id }),
      ]),
      scheduleFreshnessChecksStep([{ examBlueprintId, kind: "exam" }]),
    ]);
  }

  return { examBlueprintId, sourceIds: [], status: "ready" };
}

async function joinRunningResearch({
  context,
  identity,
  run,
}: {
  context: ResearchContext<ExamResearchPlan>;
  identity: ExamIdentity;
  run: Run<unknown>;
}): Promise<ResearchResult | null> {
  const parsed = researchResultSchema.safeParse(await joinRun(run));

  if (!parsed.success) {
    return null;
  }

  const result = parsed.data;

  if (result.status !== "ready" || !result.examBlueprintId) {
    return result;
  }

  return finishExam({
    analytics: context.analytics,
    examBlueprintId: result.examBlueprintId,
    goal: context.goal,
    isShared: !identity.ownerId,
  });
}

async function researchExam(context: ResearchContext<ExamResearchPlan>): Promise<ResearchResult> {
  const { analytics, goal, plan, uploads } = context;

  // A teacher's test is only the class's material, never the public notice onboarding matched by
  // its name ("Biology test").
  if (plan.classTest) {
    await unlinkGoalFromSharedExamStep(goal.id);
  }

  if (plan.classTest && uploads.length === 0) {
    return { reason: "classMaterial", status: "needsUpload" };
  }

  const isPrivate = plan.classTest || (await hasPrivateUploadsStep(uploads));

  const lookup = await findExamBlueprintStep({
    identity: {
      board: plan.board,
      country: plan.country,
      language: plan.language,
      name: plan.name,
      ownerId: isPrivate ? goal.userId : null,
      role: plan.role,
    },
    searchTerms: plan.searchTerms,
  });

  const { blueprintId, identity } = lookup;
  const isShared = !identity.ownerId;

  if (blueprintId && lookup.isCurrent && uploads.length === 0) {
    return finishExam({ analytics, examBlueprintId: blueprintId, goal, isShared });
  }

  const { conflict } = await claimRunToken(`research:${identity.language}:${lookup.identityKey}`);
  const joined = conflict ? await joinRunningResearch({ context, identity, run: conflict }) : null;

  if (joined) {
    return joined;
  }

  const sourceIds =
    uploads.length > 0
      ? uploads
      : await findAndStoreSources({
          analytics,
          personalPlan: goal.planPersonal,
          plan,
          requireOfficial: true,
          topic: "exam",
        });

  // A reading of the learner's uploads is theirs, even when the exam is shared, so its calls never
  // reach providers that train on prompts.
  const reading = {
    analytics: uploads.length > 0 ? { ...analytics, contentScope: "personal" as const } : analytics,
    background: false,
    exceptGoalId: goal.id,
    identity,
    isNew: !blueprintId,
    sourceIds,
  };

  const [saved] =
    sourceIds.length > 0
      ? await Promise.all([
          readExamBlueprint(reading),
          !blueprintId && uploads.length === 0
            ? recordNoticeFormatsStep({
                analytics,
                exam: describeExam(identity),
                goalId: goal.id,
                sourceIds,
              })
            : null,
        ])
      : [null];

  // An exam's content rarely changes between editions, so the last one still guides study.
  const examBlueprintId = saved?.examBlueprintId ?? blueprintId;

  if (!examBlueprintId) {
    return {
      reason: sourceIds.length > 0 ? "unverified" : "noOfficialSource",
      status: "needsUpload",
    };
  }

  return finishExam({ analytics, examBlueprintId, goal, isShared });
}

async function research({
  goal,
  input,
  runId,
}: {
  goal: ResearchGoal;
  input: ResearchInput;
  runId: string;
}): Promise<ResearchResult> {
  const topic = await detectResearchTopic(goal);

  if (topic === "none") {
    return { status: "notNeeded" };
  }

  const analytics = toResearchAnalytics({ goal, runId });
  const uploads = input.sourceIds?.length ? input.sourceIds : goal.uploadIds;

  if (topic === "exam") {
    const plan = await planExamResearchStep({ analytics, goal });
    return researchExam({ analytics, goal, plan, uploads });
  }

  const plan = await planSourceResearchStep({ analytics, goal, topic });
  return researchSources({ analytics, goal, plan, topic, uploads });
}

export async function researchWorkflow(input: ResearchInput): Promise<ResearchResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  if (!input.sourceIds?.length) {
    const { conflict } = await claimRunToken(`research-goal:${input.goalId}`);
    const joined = conflict ? researchResultSchema.safeParse(await joinRun(conflict)) : null;

    if (joined?.success) {
      return joined.data;
    }
  }

  await recordResearchRunStep({ goalId: input.goalId, runId: workflowRunId });
  const goal = await loadResearchGoalStep(input.goalId);

  if (!goal) {
    return { status: "missing" };
  }

  const result = await research({ goal, input, runId: workflowRunId });

  await recordResearchOutcomeStep({ goalId: goal.id, result });

  if (input.sourceIds?.length && result.status === "ready") {
    await start(goalContentWorkflow, [{ goalId: goal.id, rebuild: true }]);
  }

  return result;
}
