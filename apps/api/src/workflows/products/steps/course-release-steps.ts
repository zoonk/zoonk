import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { generateCourseOutline } from "@zoonk/ai/tasks/curriculum/course-outline";
import { compareReleaseLessons } from "@zoonk/ai/tasks/products/compare-release-lessons";
import {
  type CourseContentWrite,
  collectCourseContentTags,
} from "@zoonk/core/cache/course-content";
import { type OutlineChapter } from "@zoonk/core/library/curriculum/save-outline-chapter";
import { type GoalSkillRef } from "@zoonk/core/library/curriculum/scope";
import {
  type CourseReleaseState,
  loadCourseRelease,
  refreshReleasePages,
} from "@zoonk/core/library/products/course-release";
import {
  type ReleaseComparisonResult,
  type WhatsNew,
  advanceCourseRelease,
  loadReleaseComparison,
  saveWhatsNewSkills,
} from "@zoonk/core/library/products/release-advance";
import {
  findWhatsNewChapter,
  loadWhatsNewOutline,
  offerWhatsNew,
  saveWhatsNewChapter,
} from "@zoonk/core/library/products/release-offers";

type Behind = Extract<CourseReleaseState, { status: "behind" }>;

/** System work no learner waits on. */
const SERVICE_TIER = chooseServiceTier({ wait: "later" });

function toAnalytics(workflowRunId: string) {
  return { contentScope: "shared" as const, traceId: workflowRunId };
}

export async function loadCourseReleaseStep(courseId: string): Promise<CourseReleaseState> {
  "use step";
  return loadCourseRelease({ courseId });
}

export async function refreshReleasePagesStep(sourceIds: string[]): Promise<void> {
  "use step";
  await refreshReleasePages(sourceIds);
}

export async function compareReleaseStep({
  courseId,
  state,
  workflowRunId,
}: {
  courseId: string;
  state: Behind;
  workflowRunId: string;
}): Promise<ReleaseComparisonResult | null> {
  "use step";

  const input = await loadReleaseComparison({ courseId, ...state });

  if (!input) {
    return null;
  }

  const { data, provenance } = await compareReleaseLessons({
    analytics: toAnalytics(workflowRunId),
    from: input.from,
    language: input.language,
    lessons: input.lessons,
    product: input.product,
    releaseNotes: input.page.text,
    serviceTier: SERVICE_TIER,
    to: input.to,
  });

  const changed = new Set(data.changed.map(({ lesson }) => lesson - 1));

  return {
    keptLessonIds: input.lessons.filter((_, index) => !changed.has(index)).map(({ id }) => id),
    page: { contentHash: input.page.contentHash, sourceId: input.page.sourceId },
    provenance,
    release: input.to,
    whatsNew: data.whatsNew,
  };
}

/** Returns the flags of the lessons to rewrite, or null when the course moved meanwhile. */
export async function advanceCourseReleaseStep(input: {
  comparison: ReleaseComparisonResult | null;
  courseId: string;
  state: Behind;
}): Promise<string[] | null> {
  "use step";

  return advanceCourseRelease({ ...input, ...input.state });
}

export async function saveWhatsNewSkillsStep(
  input: Parameters<typeof saveWhatsNewSkills>[0],
): Promise<GoalSkillRef[]> {
  "use step";

  return saveWhatsNewSkills(input);
}

/** Code keeps the one chapter, under the title and skills the comparison gave it. */
export async function outlineWhatsNewChapterStep({
  courseId,
  skills,
  whatsNew,
  workflowRunId,
}: {
  courseId: string;
  skills: GoalSkillRef[];
  whatsNew: WhatsNew;
  workflowRunId: string;
}) {
  "use step";

  const course = await loadWhatsNewOutline(courseId);

  const { data, provenance } = await generateCourseOutline({
    analytics: toAnalytics(workflowRunId),
    courseTitle: course.courseTitle,
    language: course.language,
    level: whatsNew.level,
    otherLevelChapters: course.chapterTitles,
    requiredSkills: skills,
    serviceTier: SERVICE_TIER,
    whatsNew: whatsNew.title,
  });

  const [chapter] = data.chapters;

  if (!chapter || chapter.lessons.length === 0) {
    throw new Error(`The outline for course ${courseId} has no "What's new" chapter.`);
  }

  return {
    chapter: { ...chapter, skillKeys: skills.map((skill) => skill.key), title: whatsNew.title },
    provenance,
  };
}

export async function saveWhatsNewChapterStep(
  input: Parameters<typeof saveWhatsNewChapter>[0] & { chapter: OutlineChapter },
): Promise<CourseContentWrite<{ lessonIds: string[] }>> {
  "use step";

  return collectCourseContentTags(() => saveWhatsNewChapter(input));
}

export async function findWhatsNewChapterStep(
  input: Parameters<typeof findWhatsNewChapter>[0],
): Promise<Awaited<ReturnType<typeof findWhatsNewChapter>>> {
  "use step";
  return findWhatsNewChapter(input);
}

export async function offerWhatsNewStep(
  input: Parameters<typeof offerWhatsNew>[0],
): Promise<string | null> {
  "use step";
  return offerWhatsNew(input);
}
