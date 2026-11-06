import { type CourseReleaseState } from "@zoonk/core/library/products/course-release";
import { getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { deliverCourseContent } from "../_shared/course-content-notification";
import { repeatUntil } from "../_shared/repeat-until";
import { flaggedContentWorkflow } from "../review-flags/flagged-content-workflow";
import {
  advanceCourseReleaseStep,
  compareReleaseStep,
  findWhatsNewChapterStep,
  loadCourseReleaseStep,
  offerWhatsNewStep,
  outlineWhatsNewChapterStep,
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

async function writeWhatsNewChapter({
  courseId,
  provenance,
  releaseId,
  whatsNew,
  workflowRunId,
}: ReleaseRun & Parameters<typeof saveWhatsNewSkillsStep>[0]): Promise<WhatsNewChapter> {
  const skills = await saveWhatsNewSkillsStep({ courseId, provenance, releaseId, whatsNew });
  const outline = await outlineWhatsNewChapterStep({ courseId, skills, whatsNew, workflowRunId });

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
 * Before the course moves, so a failure here leaves it behind and the next run does it again; that
 * run offers the chapter an earlier one saved instead of writing another.
 */
async function addWhatsNew({
  comparison,
  courseId,
  state,
  workflowRunId,
}: ReleaseRun & {
  comparison: NonNullable<Awaited<ReturnType<typeof compareReleaseStep>>>;
  state: Behind;
}): Promise<void> {
  const { provenance, whatsNew } = comparison;

  if (!whatsNew) {
    return;
  }

  const releaseId = state.toReleaseId;

  const { lessonIds, skills } =
    (await findWhatsNewChapterStep({ courseId, releaseId })) ??
    (await writeWhatsNewChapter({ courseId, provenance, releaseId, whatsNew, workflowRunId }));

  const offer = {
    courseId,
    lessons: Math.max(1, Math.round(lessonIds.length / skills.length)),
    offer: whatsNew.offer,
    provenance,
    releaseId,
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

  if (comparison) {
    await addWhatsNew({ ...run, comparison, state });
  }

  const flagIds = await advanceCourseReleaseStep({ comparison, courseId: run.courseId, state });

  if (!flagIds) {
    return false;
  }

  await startRewrites(flagIds);
  return true;
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

      const advanced = await applyRelease({ courseId, state, workflowRunId });
      return { releasesApplied: applied + (advanced ? 1 : 0), status: "behind" };
    },
    times: MAX_RELEASES,
  });
}
