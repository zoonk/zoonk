import "server-only";
import {
  type CourseDetails,
  type CourseDetailsParams,
  generateCourseDetails,
} from "@zoonk/ai/tasks/v2/courses/details";
import { prisma } from "@zoonk/db";
import { type CourseCategory } from "@zoonk/utils/categories";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag } from "../../cache/tags";
import { type LibraryProvenance } from "../_utils/library-rows";

type DetailsAnalytics = CourseDetailsParams["analytics"];

/** Enough of the outline for the copy to name what the course covers, without a huge prompt. */
const MAX_PROMPT_CHAPTERS = 30;

function findCourse(courseId: string) {
  return prisma.course.findUnique({
    include: {
      categories: { select: { category: true } },
      courseChapters: {
        include: { chapter: { select: { description: true, title: true } } },
        orderBy: [{ level: "asc" }, { position: "asc" }],
        take: MAX_PROMPT_CHAPTERS,
      },
    },
    where: { id: courseId },
  });
}

type DetailsCourse = NonNullable<Awaited<ReturnType<typeof findCourse>>>;

/**
 * What the course's public page still lacks. Filled fields are never rewritten, not even a landing
 * page stored in an older shape: the change that moved the shape migrates it.
 */
function findMissingDetails({ course, copyOnly }: { course: DetailsCourse; copyOnly: boolean }) {
  return {
    categories: !copyOnly && course.categories.length === 0,
    description: !copyOnly && !course.description,
    landingPage: course.landingPage === null,
  };
}

type MissingDetails = ReturnType<typeof findMissingDetails>;

/**
 * Exam courses are listed under `exams` and language courses under `languages` because of what they
 * are, never by a model; a language exam such as IELTS is both.
 */
function getFormatCategories(course: DetailsCourse): CourseCategory[] {
  return [
    ...(course.format === "exam" ? ["exams" as const] : []),
    ...(course.targetLanguage ? ["languages" as const] : []),
  ];
}

/** A course whose categories its format sets only needs a model for its description and copy. */
function needsModel({ course, missing }: { course: DetailsCourse; missing: MissingDetails }) {
  return (
    missing.description ||
    missing.landingPage ||
    (missing.categories && getFormatCategories(course).length === 0)
  );
}

function getCategories({
  course,
  details,
}: {
  course: DetailsCourse;
  details: CourseDetails | null;
}): CourseCategory[] {
  const formatCategories = getFormatCategories(course);
  return formatCategories.length > 0 ? formatCategories : (details?.categories ?? []);
}

/** The run that wrote the landing copy; metadata-only fills must not replace its provenance. */
function toDetailsProvenanceData(provenance: LibraryProvenance) {
  return {
    detailsGeneratedAt: new Date(provenance.generatedAt),
    detailsModel: provenance.model,
    detailsPromptVersion: provenance.promptVersion,
    detailsRunId: provenance.runId,
  };
}

type GeneratedDetails = { data: CourseDetails; provenance: LibraryProvenance };

async function saveMissingDetails({
  course,
  generated,
  missing,
}: {
  course: DetailsCourse;
  generated: GeneratedDetails | null;
  missing: MissingDetails;
}): Promise<void> {
  const details = generated?.data ?? null;
  const categories = missing.categories ? getCategories({ course, details }) : [];

  await prisma.$transaction([
    prisma.course.update({
      data: {
        ...(missing.description && details && { description: details.description }),
        ...(missing.landingPage && details && { landingPage: details.landingPage }),
        ...(missing.landingPage && generated && toDetailsProvenanceData(generated.provenance)),
      },
      where: { id: course.id },
    }),
    prisma.courseCategory.createMany({
      data: categories.map((category) => ({ category, courseId: course.id })),
      skipDuplicates: true,
    }),
  ]);

  revalidateCacheTags([getCourseCacheTag(course.id), COURSE_LIST_CACHE_TAG]);
}

/**
 * Fills what a shared course's public page shows before anyone starts it: the description, the
 * landing copy (outcomes and who it's for) and its categories, which list it in the catalog and
 * give its images their subject's palette. It runs once the course has an outline, so the copy
 * names what the course covers. A course found through identity keeps what it has; only missing
 * fields are written. Private courses are never listed, so they're skipped. Returns whether
 * anything was written.
 *
 * This is a workflow bridge, not an app authorization boundary.
 */
export async function writeCourseDetails({
  analytics,
  courseId,
  copyOnly = false,
}: {
  copyOnly?: boolean;
  analytics?: DetailsAnalytics;
  courseId: string;
}): Promise<"skipped" | "written"> {
  const course = await findCourse(courseId);

  if (!course || course.visibility !== "public" || course.courseChapters.length === 0) {
    return "skipped";
  }

  const missing = findMissingDetails({ copyOnly, course });

  if (!missing.categories && !missing.description && !missing.landingPage) {
    return "skipped";
  }

  const generated = needsModel({ course, missing })
    ? await generateCourseDetails({
        analytics,
        chapters: course.courseChapters.map((placement) => ({
          description: placement.chapter.description,
          level: placement.level,
          title: placement.chapter.title,
        })),
        courseTitle: course.title,
        language: course.language,
        targetLanguage: course.targetLanguage,
      })
    : null;

  await saveMissingDetails({ course, generated, missing });

  return "written";
}
