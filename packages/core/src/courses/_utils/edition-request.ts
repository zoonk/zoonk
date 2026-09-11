import "server-only";
import { generateCanonicalCourseTitle } from "@zoonk/ai/tasks/courses/canonical-title";
import { type Course, prisma } from "@zoonk/db";
import { getContentLocale } from "@zoonk/utils/locale";
import { normalizeString } from "@zoonk/utils/string";
import { type CourseEditionResult } from "../course-editions";
import { getCompatibleCourseFormats } from "../course-prompt-generation";
import { resolveLanguageCourse } from "../language-course";
import { getCourseEditionOutcome, getEditionRestriction } from "./edition-discovery";
import { ensureCourseFamily, linkCourseEditions, lockCourseFamilies } from "./edition-family";
import { getCourseEditionPrompt } from "./edition-prompt";

/**
 * Classification is outside the lock. Concurrent callers can classify the same
 * topic, but only the winning request is returned to start a workflow. Request
 * ownership follows the source course through subsequent family merges.
 */
export async function saveEditionRequest({
  sourceCourseId,
  language,
  coursePromptId,
}: {
  sourceCourseId: string;
  language: string;
  coursePromptId: string;
}): Promise<CourseEditionResult> {
  return prisma.$transaction(async (transaction) => {
    await lockCourseFamilies(transaction);
    const source = await transaction.course.findUniqueOrThrow({ where: { id: sourceCourseId } });

    if (!source.isPublished) {
      return { kind: "notFound" };
    }

    const familyId = await ensureCourseFamily({ course: source, transaction });

    const existing = await transaction.courseEditionRequest.findFirst({
      include: { coursePrompt: { include: { course: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { language, sourceCourse: { familyId, isPublished: true } },
    });

    const selectedPrompt =
      existing?.coursePrompt ??
      (await transaction.coursePrompt.findUniqueOrThrow({
        include: { course: true },
        where: { id: coursePromptId },
      }));

    if (selectedPrompt.course?.isPublished === false) {
      return { kind: "unsupported", reason: "unavailable" };
    }

    if (
      !selectedPrompt.generationStatus ||
      selectedPrompt.intent !== "learn" ||
      !selectedPrompt.courseFormat ||
      !getCompatibleCourseFormats(source.format).includes(selectedPrompt.courseFormat) ||
      source.targetLanguage !== selectedPrompt.targetLanguage ||
      getContentLocale(selectedPrompt.language) !== language ||
      getEditionRestriction({ language, source })
    ) {
      return { kind: "unsupported", reason: "format" };
    }

    await transaction.courseEditionRequest.upsert({
      create: { coursePromptId: selectedPrompt.id, language, sourceCourseId },
      update: {},
      where: { sourceLanguage: { language, sourceCourseId } },
    });

    if (selectedPrompt.course?.isPublished) {
      await linkCourseEditions({
        courseId: selectedPrompt.course.id,
        language,
        sourceCourseId,
        transaction,
      });

      if (selectedPrompt.course.generationStatus === "completed") {
        return { course: selectedPrompt.course, kind: "course" };
      }
    }

    return {
      coursePromptId: selectedPrompt.id,
      generationStatus: selectedPrompt.generationStatus,
      kind: "generation",
    };
  });
}

/**
 * Published courses already have an intent and format. Translate their identity
 * with source context, then reuse normal course matching and generation. Running
 * free-text personalization again would mistake a catalog description for a
 * request for a personalized course.
 */
export async function resolveRegularEditionPrompt({
  source,
  language,
}: {
  source: Course;
  language: string;
}) {
  const prompt = getCourseEditionPrompt(source);
  const normalizedPrompt = normalizeString(prompt);
  const where = { languageNormalizedPrompt: { language, normalizedPrompt } };
  const cached = await prisma.coursePrompt.findUnique({ include: { course: true }, where });

  if (cached) {
    return cached;
  }

  const result = await generateCanonicalCourseTitle({ language, prompt });
  const title = result.data.title.trim();

  if (!title) {
    throw new Error("Could not resolve a localized course title");
  }

  await prisma.coursePrompt.createMany({
    data: {
      canonicalTitle: title,
      courseFormat: source.format,
      generationStatus: "pending",
      intent: "learn",
      language,
      normalizedPrompt,
      prompt,
      targetLanguage: null,
    },
    skipDuplicates: true,
  });

  return prisma.coursePrompt.findUniqueOrThrow({ include: { course: true }, where });
}

export async function resolveLanguageEdition({
  source,
  language,
}: {
  source: Course;
  language: string;
}): Promise<CourseEditionResult | { kind: "unauthorized" }> {
  if (!source.targetLanguage) {
    return { kind: "unsupported", reason: "format" };
  }

  const result = await resolveLanguageCourse({ language, targetLanguage: source.targetLanguage });

  if (result.kind === "unauthorized") {
    return result;
  }

  if (result.kind === "course") {
    return getCourseEditionOutcome({ course: result.course, language, source });
  }

  return saveEditionRequest({
    coursePromptId: result.coursePrompt.id,
    language,
    sourceCourseId: source.id,
  });
}
