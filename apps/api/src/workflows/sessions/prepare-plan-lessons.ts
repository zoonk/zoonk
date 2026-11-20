import { OUTLINE_AHEAD_DAYS } from "@zoonk/core/lookahead/outline-ahead";
import { type SessionPreparation } from "@zoonk/core/lookahead/session-preparation";
import { type PlanGenerationManifest } from "@zoonk/core/lookahead/speculative-lessons";
import { getRun, start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { type PlanStepOutcome, retryPlanConflicts } from "../_shared/plan-conflict-retry";
import { claimRunToken, startOnce, waitForRun } from "../_shared/run-token";
import { type CourseOutlineResult } from "../courses/course-outline-workflow";
import { listPlanOutlines, startAll, startPlanOutline } from "../goals/goal-outlines";
import { readGoalLookaheadStep } from "../goals/steps/goal-lookahead-steps";
import { getLessonContentHookToken } from "../lessons/lesson-content-result";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { requestGuestLessonStep } from "./steps/preparation-decision-step";
import {
  createSessionGenerationManifestStep,
  listSessionPreparationStep,
} from "./steps/session-preparation-steps";

export type PlanLessonPreparationInput = {
  goalId: string;
  guest: boolean;
  lessonsAskedAt: number | null;
  timeZone: string;
  userId: string;
};

async function startGuestLesson({
  analytics,
  input,
  lessonId,
  planManifest,
  wait,
}: {
  analytics: ContentAnalytics;
  input: PlanLessonPreparationInput;
  lessonId: string | undefined;
  planManifest: PlanGenerationManifest | null;
  wait: "learner" | "later";
}): Promise<void> {
  if (!lessonId) {
    return;
  }

  const lesson = await requestGuestLessonStep({
    lessonId,
    platform: analytics.platform ?? null,
    userId: input.userId,
  });

  if (lesson) {
    await startOnce(
      lessonContentWorkflow,
      [{ ...lesson, analytics, planGoalId: input.goalId, planManifest, wait }],
      getLessonContentHookToken(lessonId),
    );
  }
}

async function startLessonWork({
  analytics,
  input,
  previous,
}: {
  analytics: ContentAnalytics;
  input: PlanLessonPreparationInput;
  previous?: SessionPreparation;
}): Promise<PlanStepOutcome<SessionPreparation | null>> {
  using claim = await claimRunToken(`session-prep:${input.userId}`);

  // The learner's ask and the continuation of its outline wait their turn to select current lessons.
  if (claim.conflict) {
    return input.lessonsAskedAt || previous ? { conflict: true } : { conflict: false, value: null };
  }

  const preparation = await listSessionPreparationStep({ ...input, dates: previous?.dates });
  const started = new Set([...(previous?.lessonIds ?? []), ...(previous?.laterLessonIds ?? [])]);
  const lessonIds = preparation.lessonIds.filter((id) => !started.has(id));
  const laterLessonIds = preparation.laterLessonIds.filter((id) => !started.has(id));

  const manifest = await createSessionGenerationManifestStep({
    goalId: input.goalId,
    lessonIds: [...lessonIds, ...laterLessonIds],
  });

  if (manifest.conflict) {
    return manifest;
  }

  const planManifest = manifest.value;
  const admitted = new Set(planManifest?.targets.map((target) => target.lessonId));
  const soon = lessonIds.filter((id) => admitted.has(id));
  const later = laterLessonIds.filter((id) => admitted.has(id));

  if (input.guest) {
    // Preserve the guest's remaining starts for today's lesson before tomorrow's.
    await startGuestLesson({ analytics, input, lessonId: soon[0], planManifest, wait: "learner" });
    await startGuestLesson({ analytics, input, lessonId: later[0], planManifest, wait: "later" });
  } else {
    const content = {
      analytics,
      forExam: preparation.forExam,
      planGoalId: input.goalId,
      planManifest,
    };

    await startAll([
      ...soon.map((lessonId) => start(lessonContentWorkflow, [{ ...content, lessonId }])),
      ...later.map((lessonId) =>
        start(lessonContentWorkflow, [{ ...content, lessonId, wait: "later" }]),
      ),
    ]);
  }

  const requested = new Set([...lessonIds, ...laterLessonIds]);

  return {
    conflict: false,
    value: {
      ...preparation,
      laterLessonIds: [...(previous?.laterLessonIds ?? []), ...later],
      lessonIds: [...(previous?.lessonIds ?? []), ...soon],
      plannedLessonIds: preparation.plannedLessonIds.filter(
        (id) => !requested.has(id) || admitted.has(id),
      ),
    },
  };
}

async function waitForOutline(runId: string): Promise<void> {
  if (!(await waitForRun(runId))) {
    return;
  }

  const result = await getRun<CourseOutlineResult>(runId).returnValue;

  if ("nextRunId" in result && result.nextRunId) {
    await waitForOutline(result.nextRunId);
  }
}

export async function outlineAndReselect({
  analytics,
  input,
  started,
}: {
  analytics: ContentAnalytics;
  input: PlanLessonPreparationInput;
  started: string[];
}): Promise<SessionPreparation | null> {
  const preparation = await retryPlanConflicts(startLessonWork, { analytics, input });

  if (!preparation) {
    return null;
  }

  const lookahead = input.guest ? await readGoalLookaheadStep(input.goalId) : null;
  const days = lookahead?.outlineDays ?? OUTLINE_AHEAD_DAYS;
  const skillIds = preparation.standInSkillIds;
  const outlines = await listPlanOutlines({ days, goalId: input.goalId, skillIds });
  const needed = new Set(skillIds);

  await startAll(
    outlines.map(async (outline) => {
      const runId = await startPlanOutline({ analytics, forGuest: input.guest, outline, started });

      if (
        outline.bands.some(
          (band) =>
            band.skills.some((skill) => needed.has(skill.id)) ||
            band.extend?.some(({ skill }) => needed.has(skill.id)),
        )
      ) {
        await waitForOutline(runId);
      }
    }),
  );

  // The second pass reads the landed plan for the same dates and starts only its lesson children.
  return skillIds.length > 0
    ? retryPlanConflicts(startLessonWork, { analytics, input, previous: preparation })
    : preparation;
}
