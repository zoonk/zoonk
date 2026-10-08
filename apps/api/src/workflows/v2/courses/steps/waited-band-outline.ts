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
  /** The waited chapter, saved while the rest was written; `chapters` holds the rest. */
  early: EarlyOutlineChapter | null;
  provenance: OutlineProvenance;
};

/** The band's chapters without the first one teaching the waited skill, which was saved early. */
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

/**
 * Saves the chapter that teaches the waited skill the moment it's complete, where it goes among
 * the band's chapters, and re-plans the goals waiting on its skills, so the learner's first lesson
 * starts while the model still writes the rest of the band.
 */
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

      const goalIds = await replanGoalsWaitingOnSkills({
        skillIds: plan.skills
          .filter((skill) => chapter.skillKeys.includes(skill.key))
          .map((skill) => skill.id),
      });

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

/**
 * The band a learner waits on streams: see `streamWaitedBand`. An attempt after one that saved
 * the waited chapter and then failed keeps that chapter and writes the rest around it.
 */
export async function writeWaitedBand({
  input,
  serviceTier,
  waitedKey,
}: {
  input: BandInput;
  /** The tier the learner's wait gets (`chooseServiceTier`). */
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
