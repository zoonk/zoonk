import { type ServiceTier } from "@zoonk/ai/provider-options";
import {
  generateCourseOutline,
  streamCourseOutline,
} from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import {
  type EarlyOutlineChapter,
  findEarlyOutlineChapter,
  relabelOutlineRun,
} from "@zoonk/core/library/curriculum/early-outline-chapter";
import { replanGoalsWaitingOnSkills } from "@zoonk/core/library/curriculum/replan-waiting-goals";
import {
  type OutlineChapter,
  saveOutlineChapter,
} from "@zoonk/core/library/curriculum/save-outline-chapter";
import { withAiRetry } from "../../_shared/ai-retry";
import { toContentAnalytics } from "../../_shared/content-analytics";
import {
  type BandInput,
  type OutlineProvenance,
  pickChapters,
  toOutlineParams,
} from "./band-outline";

export type BandOutline = {
  chapters: OutlineChapter[];
  /** Saved while the rest was written, so it's not in `chapters`. */
  early: EarlyOutlineChapter | null;
  provenance: OutlineProvenance;
};

function withoutWaitedChapter({
  chapters,
  waitedKey,
}: {
  chapters: OutlineChapter[];
  waitedKey: string;
}): OutlineChapter[] {
  const waited = chapters.findIndex((chapter) => chapter.skillKeys.includes(waitedKey));
  return chapters.filter((_, index) => index !== waited);
}

async function streamWaitedBand({
  input,
  serviceTier,
  waitedKey,
}: {
  input: BandInput;
  serviceTier?: ServiceTier;
  waitedKey: string;
}): Promise<BandOutline> {
  const { analytics, courseId, plan, scope, workflowRunId } = input;

  const outline = await streamCourseOutline({
    ...toOutlineParams(input),
    isEarlyChapter: (chapter) => chapter.skillKeys.includes(waitedKey),
    saveEarlyChapter: async ({ before, chapter, provenance }) => {
      const kept = pickChapters({ outline: { chapters: before, uncoveredSkillKeys: [] }, plan });
      const position = plan.nextPosition + kept.length;

      const saved = await withAiRetry(() =>
        saveOutlineChapter({
          analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
          chapter,
          courseId,
          goalSkills: plan.skills,
          level: plan.level,
          position,
          provenance,
          scope,
          workflowRunId,
        }),
      );

      const replanned = await replanGoalsWaitingOnSkills({
        goalIds: analytics?.goalId ? [analytics.goalId] : [],
        skillIds: plan.skills
          .filter((skill) => chapter.skillKeys.includes(skill.key))
          .map((skill) => skill.id),
      });

      const goalIds = [...replanned.goalIds, ...replanned.failedGoalIds];

      return { chapterId: saved.chapterId, goalIds, position };
    },
    serviceTier,
  });

  if (outline.early && outline.provenance.model !== outline.provenance.requestedModel) {
    await relabelOutlineRun({ model: outline.provenance.model, runId: outline.provenance.runId });
  }

  const kept = pickChapters({ outline: outline.data, plan });

  return {
    chapters: outline.early ? withoutWaitedChapter({ chapters: kept, waitedKey }) : kept,
    early: outline.early,
    provenance: outline.provenance,
  };
}

export async function writeWaitedBand({
  input,
  serviceTier,
  waitedKey,
}: {
  input: BandInput;
  serviceTier?: ServiceTier;
  waitedKey: string;
}): Promise<BandOutline> {
  const early = await findEarlyOutlineChapter({
    courseId: input.courseId,
    level: input.plan.level,
    nextPosition: input.plan.nextPosition,
  });

  if (!early) {
    return streamWaitedBand({ input, serviceTier, waitedKey });
  }

  const { data, provenance } = await generateCourseOutline({
    ...toOutlineParams(input),
    serviceTier,
  });

  const kept = pickChapters({ outline: data, plan: input.plan });

  return { chapters: withoutWaitedChapter({ chapters: kept, waitedKey }), early, provenance };
}
