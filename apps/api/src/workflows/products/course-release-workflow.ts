import { type CourseReleaseState } from "@zoonk/core/library/products/course-release";
import { getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { deliverCourseContent } from "../_shared/course-content-notification";
import { repeatUntil } from "../_shared/repeat-until";
import { isUnusableOutput } from "../_shared/unusable-output";
import { flaggedContentWorkflow } from "../review-flags/flagged-content-workflow";
import {
  advanceCourseReleaseStep,
  compareReleaseStep,
  findWhatsNewChapterStep,
  loadCourseReleaseStep,
  loadReleaseComparisonStep,
  offerWhatsNewStep,
  outlineWhatsNewChapterStep,
  recordUncomparableReleaseStep,
  refreshReleasePagesStep,
  saveWhatsNewChapterStep,
  saveWhatsNewSkillsStep,
} from "./steps/course-release-steps";

type WhatsNewChapter = NonNullable<Awaited<ReturnType<typeof findWhatsNewChapterStep>>>;

/** The most lessons `flaggedContentWorkflow` prepares in one run. */
const FLAGS_PER_REWRITE = 10;
/** Releases one run applies; the daily sweep starts a new run for any left. */
const MAX_RELEASES = 5;
const REWRITE_WAIT = "30m";
const MAX_REWRITE_WAITS = 12;

type Behind = Extract<CourseReleaseState, { status: "behind" }>;

type ReleaseRun = { courseId: string; workflowRunId: string };

type Comparison = Awaited<ReturnType<typeof compareReleaseStep>>;

type CourseReleaseResult = {
  releasesApplied: number;
  status: CourseReleaseState["status"] | "uncomparable";
};

/** The last release's rewrites finish before the next comparison reads the course's lessons. */
function waitForRewrites(courseId: string): Promise<CourseReleaseState> {
  return repeatUntil<CourseReleaseState>({
    done: (state) => state.status !== "rewriting",
    run: () => loadCourseReleaseStep(courseId),
    times: MAX_REWRITE_WAITS,
    wait: () => sleep(REWRITE_WAIT),
  });
}

async function startRewrites(flagIds: readonly string[]): Promise<void> {
  const batches = Array.from(
    { length: Math.ceil(flagIds.length / FLAGS_PER_REWRITE) },
    (_, index) => flagIds.slice(index * FLAGS_PER_REWRITE, (index + 1) * FLAGS_PER_REWRITE),
  );

  await Promise.all(batches.map((batch) => start(flaggedContentWorkflow, [{ flagIds: batch }])));
}

/** Null when the model can't outline the chapter, so the course moves without it. */
async function writeWhatsNewChapter({
  courseId,
  provenance,
  releaseId,
  whatsNew,
  workflowRunId,
}: ReleaseRun & Parameters<typeof saveWhatsNewSkillsStep>[0]): Promise<WhatsNewChapter | null> {
  const skills = await saveWhatsNewSkillsStep({ courseId, provenance, releaseId, whatsNew });

  const outline = await outlineWhatsNewChapterStep({
    courseId,
    skills,
    whatsNew,
    workflowRunId,
  }).catch((error: unknown) => {
    if (isUnusableOutput(error)) {
      return null;
    }

    throw error;
  });

  if (!outline) {
    return null;
  }

  const { lessonIds } = await deliverCourseContent(
    saveWhatsNewChapterStep({
      chapter: outline.chapter,
      courseId,
      level: whatsNew.level,
      provenance: outline.provenance,
      releaseId,
      skills,
      workflowRunId,
    }),
  );

  return { lessonIds, skills };
}

/**
 * Before the course moves, so a failure a later run can fix leaves it behind and the next run does
 * it again; that run offers the chapter an earlier one saved instead of writing another.
 */
async function addWhatsNew({
  comparison,
  courseId,
  state,
  workflowRunId,
}: ReleaseRun & { comparison: Comparison; state: Behind }): Promise<void> {
  const { provenance, whatsNew } = comparison;

  if (!whatsNew) {
    return;
  }

  const releaseId = state.toReleaseId;

  const chapter =
    (await findWhatsNewChapterStep({ courseId, releaseId })) ??
    (await writeWhatsNewChapter({ courseId, provenance, releaseId, whatsNew, workflowRunId }));

  if (!chapter) {
    return;
  }

  const { lessonIds, skills } = chapter;

  const offer = {
    courseId,
    lessons: Math.max(1, Math.round(lessonIds.length / skills.length)),
    offer: whatsNew.offer,
    provenance,
    releaseId,
    skills,
  };

  let after: string | null = null;

  do {
    // oxlint-disable-next-line no-await-in-loop -- Each page starts after the last one's goal.
    after = await offerWhatsNewStep({ ...offer, after });
  } while (after);
}

/**
 * Null when the release has no notes page. A comparison that fails for good, such as when the
 * model refuses the notes, is recorded and the course keeps its release until those notes change.
 */
async function compareRelease({
  state,
  ...run
}: ReleaseRun & { state: Behind }): Promise<Comparison | null | "uncomparable"> {
  const notes = await loadReleaseComparisonStep({ courseId: run.courseId, state });

  if (notes.status !== "ready") {
    return notes.status === "missing" ? null : "uncomparable";
  }

  return compareReleaseStep({ input: notes.input, workflowRunId: run.workflowRunId }).catch(
    async (error: unknown) => {
      if (!isUnusableOutput(error)) {
        throw error;
      }

      await recordUncomparableReleaseStep({
        contentHash: notes.input.page.contentHash,
        courseId: run.courseId,
        releaseId: state.toReleaseId,
      });

      return "uncomparable" as const;
    },
  );
}

/** `moved` when the course moved meanwhile. */
async function applyRelease({
  state,
  ...run
}: ReleaseRun & { state: Behind }): Promise<"advanced" | "moved" | "uncomparable"> {
  await refreshReleasePagesStep(state.pageSourceIds);

  const comparison = await compareRelease({ ...run, state });

  if (comparison === "uncomparable") {
    return comparison;
  }

  // A course that taught no release has none to tell what's new against: it only gets its rewrites.
  if (comparison && state.fromReleaseId) {
    await addWhatsNew({ ...run, comparison, state });
  }

  const flagIds = await advanceCourseReleaseStep({ comparison, courseId: run.courseId, state });

  if (!flagIds) {
    return "moved";
  }

  await startRewrites(flagIds);
  return "advanced";
}

/**
 * Moves a product's main course to its current release, one release at a time: one comparison of
 * the release notes with the course's lessons, a "What's new" chapter offered to learners already
 * past the course's start, then the move itself, with the changed lessons rewritten in place. System work no learner
 * waits on; one run per course (`startCourseReleases`).
 */
export async function courseReleaseWorkflow({
  courseId,
}: {
  courseId: string;
}): Promise<CourseReleaseResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  return repeatUntil<CourseReleaseResult>({
    done: (result) => result.status !== "behind",
    run: async (previous) => {
      const applied = previous?.releasesApplied ?? 0;
      const state = await waitForRewrites(courseId);

      if (state.status !== "behind") {
        return { releasesApplied: applied, status: state.status };
      }

      const outcome = await applyRelease({ courseId, state, workflowRunId });

      if (outcome === "uncomparable") {
        return { releasesApplied: applied, status: outcome };
      }

      return { releasesApplied: applied + (outcome === "advanced" ? 1 : 0), status: "behind" };
    },
    times: MAX_RELEASES,
  });
}
