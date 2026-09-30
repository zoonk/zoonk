import { type MissingCourseBands } from "@zoonk/core/library/curriculum/course-outline-state";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { createHook, getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { claimCourseWhenFree } from "./claim-course-when-free";
import { courseDetailsWorkflow } from "./course-details-workflow";
import {
  finishCourseOutlineStep,
  planOutlineBandStep,
  saveOutlineChapterStep,
} from "./steps/course-outline-steps";
import {
  type RemainingBandOutline,
  findMissingBandsStep,
  replanGoalsForLessonsStep,
  writeRemainingBandStep,
} from "./steps/remaining-band-steps";

export type CourseRemainingBandsInput = { analytics?: ContentAnalytics; courseId: string };

type SavedBands = { bandsWritten: number; chapterIds: string[] };

export type CourseRemainingBandsResult =
  | { status: "joined" }
  | (SavedBands & { status: "written" });

/** A learner's outline run holds the course for a minute or two; saving the bands waits for it. */
const CLAIM_WAIT = "2m";
const MAX_CLAIM_TRIES = 30;

/** How analytics names this run's work when it fails; no learner waits on it. */
const GAVE_UP = { contentKind: "course", task: "course-remaining-bands" } as const;

type RunContext = CourseRemainingBandsInput & { scope: CurriculumScope; workflowRunId: string };

/** Saves one band's chapters like any band's, unless a goal needed it and wrote it meanwhile. */
async function saveBand({
  context,
  outline,
}: {
  context: RunContext;
  outline: RemainingBandOutline;
}): Promise<string[]> {
  const { analytics, courseId, scope, workflowRunId } = context;

  const plan = await planOutlineBandStep({
    band: { level: outline.level, skills: [] },
    courseId,
    scope,
  });

  // A goal needed this band while it was being written, so the goal's run wrote it first.
  if (!plan) {
    return [];
  }

  const saved = await Promise.all(
    outline.chapters.map((chapter, index) =>
      saveOutlineChapterStep({
        analytics,
        chapter,
        courseId,
        goalSkills: [],
        level: outline.level,
        position: plan.nextPosition + index,
        provenance: outline.provenance,
        scope,
        workflowRunId,
      }),
    ),
  );

  await replanGoalsForLessonsStep(saved.flatMap((chapter) => chapter.lessonIds));

  return saved.map((chapter) => chapter.chapterId);
}

/**
 * Saves the bands under the course's outline claim, like any outline run, one band after another.
 * Nothing is saved when the course stayed busy: those bands wait for the next goal.
 */
async function saveBands({
  context,
  outlines,
}: {
  context: RunContext;
  outlines: readonly RemainingBandOutline[];
}): Promise<SavedBands> {
  const { analytics, courseId, workflowRunId } = context;

  if (outlines.length === 0) {
    return { bandsWritten: 0, chapterIds: [] };
  }

  const claim = await claimCourseWhenFree({
    courseId,
    tries: MAX_CLAIM_TRIES,
    wait: () => sleep(CLAIM_WAIT),
    workflowRunId,
  });

  if (!claim.claimed) {
    return { bandsWritten: 0, chapterIds: [] };
  }

  try {
    const bands = await outlines.reduce<Promise<string[][]>>(
      async (saved, outline) => [...(await saved), await saveBand({ context, outline })],
      Promise.resolve([]),
    );

    await finishCourseOutlineStep({ courseId, status: "completed", workflowRunId });

    return {
      bandsWritten: bands.filter((chapterIds) => chapterIds.length > 0).length,
      chapterIds: bands.flat(),
    };
  } catch (error) {
    await Promise.all([
      finishCourseOutlineStep({ courseId, status: "failed", workflowRunId }),
      trackGenerationFailedStep({ ...GAVE_UP, analytics }),
    ]);

    throw error;
  }
}

/**
 * Writes every missing band at once, before claiming the course, so a learner's outline run is
 * never kept waiting on them. A band that fails after its retries and fallbacks, or comes back
 * without chapters, waits for the next goal.
 */
async function writeMissingBands({
  context,
  missing,
}: {
  context: RunContext;
  missing: MissingCourseBands;
}): Promise<RemainingBandOutline[]> {
  const { analytics, workflowRunId } = context;

  const written = await Promise.allSettled(
    missing.levels.map((level) =>
      writeRemainingBandStep({ analytics, level, missing, workflowRunId }),
    ),
  );

  const failed = written.filter((result) => result.status === "rejected");
  await Promise.all(failed.map(() => trackGenerationFailedStep({ ...GAVE_UP, analytics })));

  return written.flatMap((result) =>
    result.status === "fulfilled" && result.value.chapters.length > 0 ? [result.value] : [],
  );
}

/**
 * Completes a shared course's outline in the background. The bands a goal needs are written right
 * away by `courseOutlineWorkflow`; every other level band without chapters is written here at the
 * flex tier (nobody waits on it), whole (no goal skills, so the band covers its level for every
 * learner), and saved like any band: identity search per chapter and lesson, skills, and
 * re-planning the goals waiting on them. A band a goal needed while it was being written was
 * written by the goal's run, and this one is dropped. One run per course; once new chapters land,
 * the course's page gets whatever details it still lacks. Private courses have no levels and never
 * come here.
 */
export async function courseRemainingBandsWorkflow(
  input: CourseRemainingBandsInput,
): Promise<CourseRemainingBandsResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const hook = createHook({ token: `course-remaining-bands:${input.courseId}` });

  // The run already writing this course's bands writes every band it's missing.
  if (await hook.getConflict()) {
    return { status: "joined" };
  }

  const missing = await findMissingBandsStep(input.courseId);

  if (!missing) {
    return { bandsWritten: 0, chapterIds: [], status: "written" };
  }

  const context: RunContext = { ...input, scope: missing.scope, workflowRunId };
  const outlines = await writeMissingBands({ context, missing });
  const saved = await saveBands({ context, outlines });

  if (saved.chapterIds.length > 0) {
    await start(courseDetailsWorkflow, [{ analytics: input.analytics, courseId: input.courseId }]);
  }

  return { ...saved, status: "written" };
}
