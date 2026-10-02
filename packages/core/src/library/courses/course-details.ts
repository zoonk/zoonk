import "server-only";
import {
  type CourseDetails,
  type CourseDetailsParams,
  generateCourseDetails,
} from "@zoonk/ai/tasks/v2/courses/details";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag } from "../../cache/tags";
import { parseCourseLandingPageContent } from "../../courses/course-landing-page";
import { type LibraryProvenance } from "../_utils/library-rows";

type DetailsAnalytics = CourseDetailsParams["analytics"];

/** Enough of the outline for the copy to name what the course covers, without a huge prompt. */
const MAX_PROMPT_CHAPTERS = 30;

/** Language courses are listed under `languages` because of what they are, never by a model. */
const LANGUAGE_CATEGORY = "languages";

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

/** What the course's public page still lacks. Filled fields are never rewritten. */
function findMissingDetails(course: DetailsCourse) {
  return {
    categories: course.categories.length === 0,
    description: !course.description,
    landingPage: !parseCourseLandingPageContent(course.landingPage),
  };
}

type MissingDetails = ReturnType<typeof findMissingDetails>;

/** A language course's category is known, so only its description and landing copy need a model. */
function needsModel({ course, missing }: { course: DetailsCourse; missing: MissingDetails }) {
  return (
    missing.description || missing.landingPage || (missing.categories && !course.targetLanguage)
  );
}

function getCategories({
  course,
  details,
}: {
  course: DetailsCourse;
  details: CourseDetails | null;
}): string[] {
  return course.targetLanguage ? [LANGUAGE_CATEGORY] : (details?.categories ?? []);
}

/** The details run that wrote the course page's copy, kept apart from the run that named the course. */
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
        ...(generated && toDetailsProvenanceData(generated.provenance)),
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
}: {
  analytics?: DetailsAnalytics;
  courseId: string;
}): Promise<"skipped" | "written"> {
  const course = await findCourse(courseId);

  if (!course || course.visibility !== "public" || course.courseChapters.length === 0) {
    return "skipped";
  }

  const missing = findMissingDetails(course);

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
