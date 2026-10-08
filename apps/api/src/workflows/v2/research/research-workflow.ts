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
import { planResearchStep } from "./steps/plan-research-step";
import { recordResearchOutcomeStep } from "./steps/record-research-outcome-step";
import { recordResearchRunStep } from "./steps/record-research-run-step";
import { lookUpSubjectQuestionsStep } from "./steps/subject-questions-step";
import { lookUpTargetCutoffStep } from "./steps/target-cutoff-step";
import { lookUpTopicFrequencyStep } from "./steps/topic-frequency-step";

export type ResearchInput = {
  goalId: string;
  /**
   * Uploads the learner gave after research asked for the notice; read instead of searching. When
   * absent or empty, the material the learner uploaded with the goal.
   */
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

  // A shared exam's notice keeps being checked while anyone studies it, and gets its subjects'
  // counts, its questions' options and how often its topics are asked from past editions when it
  // says none; a private one is an upload. An entrance exam goal also gets how its course weighs
  // the exam's parts, and a goal aiming at a course or a position its target's last cut-off.
  if (isShared) {
    await Promise.all([
      lookUpChoiceOptionsStep({ analytics, examBlueprintId }),
      lookUpSubjectQuestionsStep({ analytics, examBlueprintId }),
      lookUpTopicFrequencyStep({ analytics, examBlueprintId }),
      lookUpCourseWeightsStep({ analytics, goalId: goal.id }),
      lookUpTargetCutoffStep({ analytics, goalId: goal.id }),
      scheduleFreshnessChecksStep([{ examBlueprintId, kind: "exam" }]),
    ]);
  }

  return { examBlueprintId, sourceIds: [], status: "ready" };
}

/**
 * Another learner's run is researching this exam: wait for it instead of paying twice. Null when
 * it ended without a result (it failed, or stalled and was stopped): this run researches the exam
 * itself instead of failing with it.
 */
async function joinRunningResearch({
  context,
  identity,
  run,
}: {
  context: ResearchContext;
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

async function researchExam(context: ResearchContext): Promise<ResearchResult> {
  const { analytics, goal, plan, uploads } = context;

  // A teacher's test is described only by the class's material: never searched, never shared, and
  // never the public notice onboarding matched by its name ("Prova de biologia").
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

  if (blueprintId && lookup.isCurrent && !lookup.readsAgain && uploads.length === 0) {
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
      : await findAndStoreSources({ analytics, plan, requireOfficial: true, topic: "exam" });

  const reading = {
    analytics,
    background: false,
    exceptGoalId: goal.id,
    identity,
    isNew: !blueprintId,
    quiet: lookup.readsAgain,
    sourceIds,
  };

  // A new exam's notice takes minutes to read, while the learner's placement waits on how its
  // questions look: a first pass reads only that, beside the reading.
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
  // No uploads to answer an ask with (the API starts research with an empty list) means the
  // material the learner gave with the goal.
  const uploads = input.sourceIds?.length ? input.sourceIds : goal.uploadIds;
  const context = { analytics, goal, plan, uploads };

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

  // Research without uploads runs once per goal at a time: a second start waits for the first,
  // and researches the goal itself when the first ends without a result.
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

  // The plan was built before the learner's upload gave research what it asked for.
  if (input.sourceIds?.length && result.status === "ready") {
    await start(goalContentWorkflow, [{ goalId: goal.id, rebuild: true }]);
  }

  return result;
}
