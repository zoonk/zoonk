import "server-only";
import { type Course, prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { getContentLocale } from "@zoonk/utils/locale";
import { normalizeString } from "@zoonk/utils/string";
import { type CourseEditionResult } from "../course-editions";
import { isRegularCourseFormat } from "../course-prompt-generation";
import {
  chooseCourseEdition,
  findFamilyCourse,
  haveCompatibleEditionIdentity,
  linkCourseEditions,
  lockCourseFamilies,
} from "./edition-family";
import { getCourseEditionPrompt } from "./edition-prompt";

export async function getSourceCourse(courseId: string) {
  return prisma.course.findFirst({
    include: { organization: true },
    where: { id: courseId, isPublished: true, organization: { kind: "brand" } },
  });
}

export function getEditionRestriction({
  source,
  language,
}: {
  source: Course;
  language: string;
}): CourseEditionResult | null {
  if (source.format === "language") {
    if (!isTTSSupportedLanguage(source.targetLanguage)) {
      return { kind: "unsupported", reason: "format" };
    }

    return getContentLocale(source.targetLanguage ?? "") === language
      ? { kind: "unsupported", reason: "sameLanguage" }
      : null;
  }

  return isRegularCourseFormat(source.format) && source.targetLanguage === null
    ? null
    : { kind: "unsupported", reason: "format" };
}

export async function getStoredEditionRequest({
  source,
  language,
}: {
  source: Course;
  language: string;
}) {
  return prisma.courseEditionRequest.findFirst({
    include: { coursePrompt: { include: { course: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: {
      language,
      sourceCourse: {
        isPublished: true,
        ...(source.familyId ? { familyId: source.familyId } : { id: source.id }),
      },
    },
  });
}

/**
 * Legacy courses become related only when a visitor encounters them. Cached
 * prompt identities and finite language targets are safe to reuse here without
 * running a model or starting generation on a GET or a prefetch.
 */
export async function findKnownEdition({
  source,
  language,
}: {
  source: Course;
  language: string;
}): Promise<Course | null> {
  if (source.familyId) {
    const course = await findFamilyCourse({
      familyId: source.familyId,
      language,
      transaction: prisma,
    });

    if (course && haveCompatibleEditionIdentity({ course, source })) {
      return course;
    }
  }

  if (source.format === "language") {
    const courses = await prisma.course.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: {
        format: "language",
        isPublished: true,
        organizationId: source.organizationId,
        targetLanguage: source.targetLanguage,
      },
    });

    return chooseCourseEdition(
      courses.filter((course) => getContentLocale(course.language) === language),
    );
  }

  const prompt = await prisma.coursePrompt.findUnique({
    include: { course: true },
    where: {
      languageNormalizedPrompt: {
        language,
        normalizedPrompt: normalizeString(getCourseEditionPrompt(source)),
      },
    },
  });

  const course = prompt?.course;

  return course?.isPublished &&
    getContentLocale(course.language) === language &&
    haveCompatibleEditionIdentity({ course, source })
    ? course
    : null;
}

async function attachKnownEdition({
  source,
  course,
  language,
}: {
  source: Course;
  course: Course;
  language: string;
}) {
  if (!source.familyId || source.familyId !== course.familyId) {
    await prisma.$transaction(async (transaction) => {
      await lockCourseFamilies(transaction);

      await linkCourseEditions({
        courseId: course.id,
        language,
        sourceCourseId: source.id,
        transaction,
      });
    });
  }
}

export async function getCourseEditionOutcome({
  course,
  source,
  language,
}: {
  course: Course;
  source: Course;
  language: string;
}): Promise<CourseEditionResult> {
  if (!course.isPublished) {
    return { kind: "unsupported", reason: "unavailable" };
  }

  if (
    getContentLocale(course.language) !== language ||
    !haveCompatibleEditionIdentity({ course, source })
  ) {
    return { kind: "unsupported", reason: "format" };
  }

  await attachKnownEdition({ course, language, source });

  if (course.generationStatus === "completed") {
    return { course, kind: "course" };
  }

  const prompts = await prisma.coursePrompt.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: { courseId: course.id, generationStatus: { not: null } },
  });

  const compatiblePrompts = prompts.filter(
    (prompt) => getContentLocale(prompt.language) === language,
  );

  const prompt =
    compatiblePrompts.find(
      (item) =>
        item.generationRunId === course.generationRunId &&
        item.generationStatus === course.generationStatus,
    ) ?? compatiblePrompts[0];

  if (prompt?.generationStatus) {
    return {
      coursePromptId: prompt.id,
      generationStatus: prompt.generationStatus,
      kind: "generation",
    };
  }

  return { kind: "missing" };
}
