import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseChapter } from "@zoonk/ai/tasks/courses/chapters";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type Chapter, type ChapterCreateManyInput, prisma } from "@zoonk/db";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { type CourseContext } from "./initialize-course-step";

/**
 * Main chapter generation can run after the intro chapter has already been
 * saved. Loading the current chapter slugs lets the batch avoid the course-level
 * unique constraint instead of only deduplicating within the new AI output.
 */
async function getExistingChapterSlugs(courseId: string): Promise<string[]> {
  const chapters = await prisma.chapter.findMany({ where: { courseId } });

  return chapters.map((chapter) => chapter.slug);
}

/**
 * Suffixes a generated chapter slug until it does not collide with any slug that
 * is already taken in this course or earlier in the same insert batch.
 */
function getAvailableChapterSlug({
  baseSlug,
  suffix = 0,
  takenSlugs,
}: {
  baseSlug: string;
  suffix?: number;
  takenSlugs: Set<string>;
}): string {
  const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix}`;

  if (!takenSlugs.has(candidate)) {
    return candidate;
  }

  return getAvailableChapterSlug({ baseSlug, suffix: suffix + 1, takenSlugs });
}

/**
 * Assigns slugs in order so duplicate generated titles keep stable learner-facing
 * URLs while still respecting existing chapter rows.
 */
function deduplicateChapterSlugs({
  chapters,
  takenSlugs,
}: {
  chapters: ChapterCreateManyInput[];
  takenSlugs: Set<string>;
}): ChapterCreateManyInput[] {
  const [chapter, ...remainingChapters] = chapters;

  if (!chapter) {
    return [];
  }

  const slug = getAvailableChapterSlug({ baseSlug: chapter.slug, takenSlugs });
  const nextTakenSlugs = new Set([...takenSlugs, slug]);

  return [
    { ...chapter, slug },
    ...deduplicateChapterSlugs({ chapters: remainingChapters, takenSlugs: nextTakenSlugs }),
  ];
}

export async function addChaptersStep(input: {
  course: CourseContext;
  chapters: CourseChapter[];
  positionOffset?: number;
}): Promise<Chapter[]> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "addChapters" });

  const existingChapterSlugs = await getExistingChapterSlugs(input.course.courseId);

  const chaptersData: ChapterCreateManyInput[] = deduplicateChapterSlugs({
    chapters: input.chapters.map((chapter, index) => ({
      courseId: input.course.courseId,
      description: chapter.description,
      generationStatus: "pending" as const,
      isPublished: true,
      language: input.course.language,
      normalizedTitle: normalizeString(chapter.title),
      organizationId: input.course.organizationId,
      position: index + (input.positionOffset ?? 0),
      slug: toSlug(chapter.title),
      title: chapter.title,
    })),
    takenSlugs: new Set(existingChapterSlugs),
  });

  const createdChapters = await prisma.chapter.createManyAndReturn({ data: chaptersData });

  await stream.status({ status: "completed", step: "addChapters" });

  return createdChapters;
}
