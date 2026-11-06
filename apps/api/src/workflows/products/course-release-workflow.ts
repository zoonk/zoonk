import { type CourseReleaseState } from "@zoonk/core/library/products/course-release";
import { getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { deliverCourseContent } from "../_shared/course-content-notification";
import { repeatUntil } from "../_shared/repeat-until";
import { flaggedContentWorkflow } from "../review-flags/flagged-content-workflow";
import {
  advanceCourseReleaseStep,
  compareReleaseStep,
  loadCourseReleaseStep,
  offerWhatsNewStep,
  outlineWhatsNewChapterStep,
  refreshReleasePagesStep,
  saveWhatsNewChapterStep,
} from "./steps/course-release-steps";

/** The most lessons `flaggedContentWorkflow` prepares in one run. */
const FLAGS_PER_REWRITE = 10;
/** Releases one run applies; the daily sweep starts a new run for any left. */
const MAX_RELEASES = 5;
const REWRITE_WAIT = "30m";
const MAX_REWRITE_WAITS = 12;
const MAX_OFFER_PAGES = 200;

type Behind = Extract<CourseReleaseState, { status: "behind" }>;

type ReleaseRun = { courseId: string; workflowRunId: string };

type CourseReleaseResult = { releasesApplied: number; status: CourseReleaseState["status"] };

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

async function addWhatsNew({
  advance,
  comparison,
  courseId,
  state,
  workflowRunId,
}: ReleaseRun & {
  advance: NonNullable<Awaited<ReturnType<typeof advanceCourseReleaseStep>>>;
  comparison: NonNullable<Awaited<ReturnType<typeof compareReleaseStep>>>;
  state: Behind;
}): Promise<void> {
  const { whatsNew } = comparison;
  const { skills } = advance;

  if (!whatsNew || skills.length === 0) {
    return;
  }

  const outline = await outlineWhatsNewChapterStep({ courseId, skills, whatsNew, workflowRunId });

  const { lessonIds } = await deliverCourseContent(
    saveWhatsNewChapterStep({
      chapter: outline.chapter,
      courseId,
      level: whatsNew.level,
      provenance: outline.provenance,
      skills,
      workflowRunId,
    }),
  );

  const offer = {
    advancedAt: advance.advancedAt,
    courseId,
    lessons: Math.max(1, Math.round(lessonIds.length / skills.length)),
    offer: whatsNew.offer,
    provenance: comparison.provenance,
    releaseId: state.toReleaseId,
    skills,
  };

  await repeatUntil<string | null>({
    done: (next) => next === null,
    run: (after) => offerWhatsNewStep({ ...offer, after: after ?? null }),
    times: MAX_OFFER_PAGES,
  });
}

async function applyRelease({ state, ...run }: ReleaseRun & { state: Behind }): Promise<boolean> {
  await refreshReleasePagesStep(state.pageSourceIds);

  const comparison = await compareReleaseStep({ ...run, state });
  const advance = await advanceCourseReleaseStep({ comparison, courseId: run.courseId, state });

  if (!advance) {
    return false;
  }

  await startRewrites(advance.flagIds);

  if (comparison) {
    await addWhatsNew({ ...run, advance, comparison, state });
  }

  return true;
}

/**
 * Moves a product's main course to its current release, one release at a time: one comparison of
 * the release notes with the course's lessons, the changed lessons rewritten in place, and a
 * "What's new" chapter offered to learners already past the course's start. System work no learner
 * waits on; one run per course (`getCourseReleaseToken`).
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

      const advanced = await applyRelease({ courseId, state, workflowRunId });
      return { releasesApplied: applied + (advanced ? 1 : 0), status: "behind" };
    },
    times: MAX_RELEASES,
  });
}

/** One release update per course: start it with `startOnce` and this token. */
export function getCourseReleaseToken(courseId: string): string {
  return `course-release:${courseId}`;
}
