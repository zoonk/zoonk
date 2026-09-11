import "server-only";
import { type Course, type GenerationStatus, prisma } from "@zoonk/db";
import { getContentLocale } from "@zoonk/utils/locale";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getSession } from "../users/get-session";
import { getReusableCourseForCoursePrompt } from "./_utils/course-prompt-reusable-course";
import {
  findKnownEdition,
  getCourseEditionOutcome,
  getEditionRestriction,
  getSourceCourse,
  getStoredEditionRequest,
} from "./_utils/edition-discovery";
import {
  resolveLanguageEdition,
  resolveRegularEditionPrompt,
  saveEditionRequest,
} from "./_utils/edition-request";

export type CourseEditionResult =
  | { kind: "course"; course: Course }
  | { kind: "generation"; coursePromptId: string; generationStatus: GenerationStatus }
  | { kind: "missing" }
  | { kind: "notFound" }
  | { kind: "unsupported"; reason: "sameLanguage" | "format" | "language" | "unavailable" };

type CourseEditionInput = { courseId: string; language: string };

/**
 * Discovers available editions and existing work. This may persist a proven
 * legacy association, but cannot classify prompts, enroll users or generate
 * content. Missing results stay uncached so newly resolved editions appear.
 */
export async function getCourseEdition({
  courseId,
  language,
}: CourseEditionInput): Promise<CourseEditionResult> {
  const locale = getContentLocale(language);

  if (!locale) {
    return { kind: "unsupported", reason: "language" };
  }

  const source = await getSourceCourse(courseId);

  if (!source) {
    return { kind: "notFound" };
  }

  if (getContentLocale(source.language) === locale) {
    return { course: source, kind: "course" };
  }

  if (source.organization?.slug !== AI_ORG_SLUG) {
    return { kind: "unsupported", reason: "format" };
  }

  const restriction = getEditionRestriction({ language: locale, source });

  if (restriction) {
    return restriction;
  }

  const [course, request] = await Promise.all([
    findKnownEdition({ language: locale, source }),
    getStoredEditionRequest({ language: locale, source }),
  ]);

  if (course) {
    return getCourseEditionOutcome({ course, language: locale, source });
  }

  if (request?.coursePrompt.course?.isPublished === false) {
    return { kind: "unsupported", reason: "unavailable" };
  }

  if (request?.coursePrompt.course?.isPublished) {
    return getCourseEditionOutcome({
      course: request.coursePrompt.course,
      language: locale,
      source,
    });
  }

  if (request?.coursePrompt.generationStatus) {
    return {
      coursePromptId: request.coursePromptId,
      generationStatus: request.coursePrompt.generationStatus,
      kind: "generation",
    };
  }

  return { kind: "missing" };
}

/** Only an authenticated, explicit action can prepare a new course edition. */
export async function resolveCourseEdition(
  input: CourseEditionInput,
): Promise<CourseEditionResult | { kind: "unauthorized" }> {
  const known = await getCourseEdition(input);

  if (known.kind !== "missing") {
    return known;
  }

  const session = await getSession();

  if (!session) {
    return { kind: "unauthorized" };
  }

  const source = await getSourceCourse(input.courseId);
  const language = getContentLocale(input.language);

  if (!source) {
    return { kind: "notFound" };
  }

  if (!language) {
    return { kind: "unsupported", reason: "language" };
  }

  const restriction = getEditionRestriction({ language, source });

  if (restriction) {
    return restriction;
  }

  if (source.format === "language") {
    return resolveLanguageEdition({ language, source });
  }

  const prompt = await resolveRegularEditionPrompt({ language, source });

  const saved = await saveEditionRequest({
    coursePromptId: prompt.id,
    language,
    sourceCourseId: source.id,
  });

  if (saved.kind !== "generation") {
    return saved;
  }

  const selected = await prisma.coursePrompt.findUniqueOrThrow({
    include: { course: true },
    where: { id: saved.coursePromptId },
  });

  const reusable = await getReusableCourseForCoursePrompt(selected);

  if (reusable) {
    const course = await prisma.course.findUniqueOrThrow({ where: { id: reusable.id } });
    return getCourseEditionOutcome({ course, language, source });
  }

  return saved;
}
