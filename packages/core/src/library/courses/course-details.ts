import "server-only";
import {
  type CourseDetails,
  type CourseDetailsParams,
  generateCourseDetails,
} from "@zoonk/ai/tasks/v2/courses/details";
import { prisma } from "@zoonk/db";
import { type CourseCategory } from "@zoonk/utils/categories";
import { revalidateCourseContent } from "../../cache/revalidate-course-content";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag } from "../../cache/tags";
import { type LibraryProvenance } from "../_utils/library-rows";

type DetailsAnalytics = CourseDetailsParams["analytics"];

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

function findMissingDetails({ course, copyOnly }: { course: DetailsCourse; copyOnly: boolean }) {
  return {
    categories: !copyOnly && course.categories.length === 0,
    description: !copyOnly && !course.description,
    landingPage: course.landingPage === null,
  };
}

type MissingDetails = ReturnType<typeof findMissingDetails>;

function getFormatCategories(course: DetailsCourse): CourseCategory[] {
  return [
    ...(course.format === "exam" ? ["exams" as const] : []),
    ...(course.targetLanguage ? ["languages" as const] : []),
  ];
}

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

  await revalidateCourseContent([getCourseCacheTag(course.id), COURSE_LIST_CACHE_TAG]);
}

/** Internal workflow bridge, not an app authorization boundary. */
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
