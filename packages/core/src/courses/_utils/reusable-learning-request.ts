import { type LearningRequestSubject } from "@zoonk/ai/tasks/courses/request";
import { getAiGenerationCourseWhere, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { getCompatibleCourseFormats } from "../course-prompt-generation";
import { getCourseSlugForTitle } from "../course-slug";

/** This input contains a public-safe teaching subject only; private learner context is stored separately. */
export async function resolveReusableLearningSubject({
  language,
  subject,
}: {
  language: string;
  subject: LearningRequestSubject;
}) {
  const slug = getCourseSlugForTitle({ language, title: subject.title });

  const course = await prisma.course.findFirst({
    include: { organization: true },
    where: getAiGenerationCourseWhere({
      format: { in: getCompatibleCourseFormats(subject.format) },
      generationStatus: "completed",
      isPublished: true,
      language,
      ...(subject.format === "language" && subject.targetLanguage
        ? { targetLanguage: subject.targetLanguage }
        : { slug }),
      userId: null,
    }),
  });

  if (course) {
    return {
      course: {
        brandSlug: course.organization?.slug ?? "",
        format: course.format,
        id: course.id,
        slug: course.slug,
      },
      kind: "course" as const,
    };
  }

  const safePrompt = subject.title;
  const intent = subject.format === "question" ? "question" : "learn";

  const prompt = await prisma.coursePrompt.upsert({
    create: {
      canonicalTitle: subject.title,
      courseFormat: subject.format,
      generationStatus: "pending",
      intent,
      language,
      normalizedPrompt: normalizeString(safePrompt),
      prompt: safePrompt,
      targetLanguage: subject.targetLanguage,
    },
    update: {},
    where: {
      languageNormalizedPrompt: { language, normalizedPrompt: normalizeString(safePrompt) },
    },
  });

  if (prompt.generationStatus === null) {
    await prisma.coursePrompt.updateMany({
      data: {
        canonicalTitle: subject.title,
        courseFormat: subject.format,
        generationStatus: "pending",
        intent,
        targetLanguage: subject.targetLanguage,
      },
      where: { generationStatus: null, id: prompt.id },
    });
  }

  return {
    kind: "generate" as const,
    prompt: {
      canonicalTitle: prompt.canonicalTitle ?? subject.title,
      courseFormat: prompt.courseFormat ?? subject.format,
      id: prompt.id,
      intent: prompt.generationStatus === null ? intent : prompt.intent,
    },
  };
}
