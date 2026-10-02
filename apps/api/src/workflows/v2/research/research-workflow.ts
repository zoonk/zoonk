import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import { createHook, getWorkflowMetadata } from "workflow";
import { start } from "workflow/api";
import { scheduleFreshnessChecksStep } from "../freshness/steps/schedule-freshness-checks-step";
import { goalContentWorkflow } from "../goals/goal-content-workflow";
import { toResearchAnalytics } from "./_utils/research-analytics";
import { readExamBlueprint } from "./read-exam-blueprint";
import { type ResearchResult, researchResultSchema } from "./research-result";
import { type ResearchContext, findAndStoreSources, researchSources } from "./research-sources";
import { detectResearchTopic } from "./research-topic";
import { findExamBlueprintStep } from "./steps/find-exam-blueprint-step";
import { hasPrivateUploadsStep } from "./steps/inspect-uploads-step";
import { linkGoalToBlueprintStep } from "./steps/link-goal-step";
import { type ResearchGoal, loadResearchGoalStep } from "./steps/load-research-goal-step";
import { planResearchStep } from "./steps/plan-research-step";
import { recordResearchOutcomeStep } from "./steps/record-research-outcome-step";
import { recordResearchRunStep } from "./steps/record-research-run-step";

export type ResearchInput = {
  goalId: string;
  /**
   * Uploads the learner gave after research asked for the notice; read instead of searching. By
   * default, the material the learner uploaded with the goal.
   */
  sourceIds?: string[];
};

async function finishExam({
  examBlueprintId,
  goal,
  isShared,
}: {
  examBlueprintId: string;
  goal: ResearchGoal;
  isShared: boolean;
}): Promise<ResearchResult> {
  await linkGoalToBlueprintStep({ examBlueprintId, goalId: goal.id });

  // A shared exam's notice keeps being checked while anyone studies it; a private one is an upload.
  if (isShared) {
    await scheduleFreshnessChecksStep([{ examBlueprintId, kind: "exam" }]);
  }

  return { examBlueprintId, sourceIds: [], status: "ready" };
}

/** Another learner's run is researching this exam: wait for it instead of paying twice. */
async function joinRunningResearch({
  context,
  identity,
  returnValue,
}: {
  context: ResearchContext;
  identity: ExamIdentity;
  returnValue: Promise<unknown>;
}): Promise<ResearchResult> {
  const result = researchResultSchema.parse(await returnValue);

  if (result.status !== "ready" || !result.examBlueprintId) {
    return result;
  }

  return finishExam({
    examBlueprintId: result.examBlueprintId,
    goal: context.goal,
    isShared: !identity.ownerId,
  });
}

async function researchExam(context: ResearchContext): Promise<ResearchResult> {
  const { analytics, goal, plan, uploads } = context;

  // A teacher's test is described only by the class's material: never searched, never shared.
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
    return finishExam({ examBlueprintId: blueprintId, goal, isShared });
  }

  const claim = createHook({ token: `research:${identity.language}:${lookup.identityKey}` });
  const conflict = await claim.getConflict();

  if (conflict) {
    return joinRunningResearch({ context, identity, returnValue: conflict.returnValue });
  }

  const sourceIds =
    uploads.length > 0
      ? uploads
      : await findAndStoreSources({ analytics, plan, requireOfficial: true, topic: "exam" });

  const saved =
    sourceIds.length > 0
      ? await readExamBlueprint({
          analytics,
          identity,
          isNew: !blueprintId,
          priority: true,
          sourceIds,
        })
      : null;

  // An exam's content rarely changes between editions, so the last one still guides study.
  const examBlueprintId = saved?.examBlueprintId ?? blueprintId;

  if (!examBlueprintId) {
    return {
      reason: sourceIds.length > 0 ? "unverified" : "noOfficialSource",
      status: "needsUpload",
    };
  }

  return finishExam({ examBlueprintId, goal, isShared });
}

/** Research for one goal: its topic, the plan for it, and the exam or the sources it reads. */
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
  const plan = await planResearchStep({ analytics, goal, topic });
  const context = { analytics, goal, plan, uploads: input.sourceIds ?? goal.uploadIds };

  if (topic === "exam") {
    return researchExam(context);
  }

  return researchSources({ ...context, topic });
}

/**
 * Builds a goal from dated sources when it depends on facts that change: an
 * exam's notice, a law, a product's documentation; and checks a big learn goal
 * against reference syllabi. It reuses the canonical blueprint or the stored
 * sources when they exist, runs once per exam when several learners start
 * together, searches official domains first, keeps only facts that match
 * their passages, and asks the learner to upload the notice instead of
 * guessing an exam's structure. Plan and Today show that ask until the learner
 * answers it; an upload that answers it rebuilds the goal's curriculum from it.
 * The goal remembers its run, so asking again follows it instead of paying again.
 */
export async function researchWorkflow(input: ResearchInput): Promise<ResearchResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  // Research without uploads runs once per goal at a time: a second start waits for the first.
  if (!input.sourceIds?.length) {
    const hook = createHook({ token: `research-goal:${input.goalId}` });
    const conflict = await hook.getConflict();

    if (conflict) {
      return researchResultSchema.parse(await conflict.returnValue);
    }
  }

  await recordResearchRunStep({ goalId: input.goalId, runId: workflowRunId });
  const goal = await loadResearchGoalStep(input.goalId);

  if (!goal) {
    return { status: "missing" };
  }

  const result = await research({ goal, input, runId: workflowRunId });

  await recordResearchOutcomeStep({ goalId: goal.id, result });

  // The plan was built before the learner's upload gave research what it asked for.
  if (input.sourceIds?.length && result.status === "ready") {
    await start(goalContentWorkflow, [{ goalId: goal.id, rebuild: true }]);
  }

  return result;
}
