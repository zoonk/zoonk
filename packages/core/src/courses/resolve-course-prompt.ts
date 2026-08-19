import { generateCanonicalCourseTitle } from "@zoonk/ai/tasks/courses/canonical-title";
import {
  type CourseFormat as ClassifiedCourseFormat,
  classifyCourseFormat,
} from "@zoonk/ai/tasks/courses/format";
import { type CourseIntent, classifyCourseIntent } from "@zoonk/ai/tasks/courses/intent";
import { classifyCoursePersonalization } from "@zoonk/ai/tasks/courses/personalization";
import { type CoursePrompt, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { getSession } from "../users/get-session";
import { getReusableCourseForCoursePrompt } from "./_utils/course-prompt-reusable-course";
import { type CoursePromptWithCourse } from "./_utils/course-prompt-types";
import { COURSE_LANGUAGE_MAX_LENGTH, COURSE_PROMPT_MAX_LENGTH } from "./course-prompt-contract";
import { isRegularCourseFormat } from "./course-prompt-generation";

type PromptIntent = CoursePrompt["intent"];
type PersistedCourseFormat = CoursePrompt["courseFormat"];
type UnsupportedPromptIntent = Extract<PromptIntent, "ambiguous" | "learn" | "question">;

export type UnsupportedCoursePrompt = {
  courseFormat: PersistedCourseFormat;
  intent: UnsupportedPromptIntent;
};

export type CoursePromptResolution =
  | { course: { id: string; slug: string }; kind: "course" }
  | { kind: "exam" }
  | {
      kind: "generate";
      prompt: Pick<CoursePrompt, "canonicalTitle" | "courseFormat" | "id" | "intent">;
    }
  | { kind: "invalid"; reason: "language" | "prompt" }
  | { kind: "language" }
  | { kind: "unauthorized" }
  | { kind: "unsafe" }
  | { kind: "unsupported"; prompt: UnsupportedCoursePrompt; title: string };

type CoursePromptInput = Pick<
  CoursePrompt,
  "canonicalTitle" | "courseFormat" | "generationStatus" | "intent" | "targetLanguage"
>;

/**
 * Rejects input that delivery controls can be bypassed into sending directly
 * to Core. The guard runs before cache lookup or model work so every app shares
 * the same persisted-language and AI-cost boundaries.
 */
function getCoursePromptInputError({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): "language" | "prompt" | null {
  const promptLength = prompt.trim().length;

  if (promptLength === 0 || promptLength > COURSE_PROMPT_MAX_LENGTH) {
    return "prompt";
  }

  const languageLength = language.trim().length;

  if (languageLength < 2 || languageLength > COURSE_LANGUAGE_MAX_LENGTH) {
    return "language";
  }

  return null;
}

/**
 * Finds the cached prompt classification for this locale and prompt. The
 * prompt row is the durable boundary for the start architecture, so repeat
 * prompts can skip AI routing and title generation.
 */
async function findCachedCoursePrompt({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): Promise<CoursePromptWithCourse | null> {
  return prisma.coursePrompt.findUnique({
    include: { course: true },
    where: { languageNormalizedPrompt: { language, normalizedPrompt: normalizeString(prompt) } },
  });
}

/**
 * Keeps the supported-generation check in one place. Regular formats use the
 * current course workflow, while language prompts only generate after the
 * dedicated language start flow has stored a concrete target language.
 */
function canGenerateCoursePrompt({
  courseFormat,
  intent,
  targetLanguage,
}: Pick<CoursePrompt, "courseFormat" | "intent" | "targetLanguage">): boolean {
  if (intent !== "learn") {
    return false;
  }

  if (isRegularCourseFormat(courseFormat)) {
    return true;
  }

  return courseFormat === "language" && Boolean(targetLanguage);
}

/**
 * Promotes legacy waitlist rows when their format becomes generatable. The
 * conditional update cannot replace a newer running or completed status when
 * two visits or a workflow start race with this cached resolution.
 */
async function enableCoursePromptGeneration(prompt: CoursePrompt): Promise<void> {
  if (prompt.generationStatus !== null) {
    return;
  }

  await prisma.coursePrompt.updateMany({
    data: { generationStatus: "pending" },
    where: { generationStatus: null, id: prompt.id },
  });
}

/**
 * Converts a persisted prompt into a portable domain outcome. This mapping is
 * reused for cached and new prompts so first submissions and repeat visits
 * cannot drift while each delivery layer remains free to choose its own route.
 */
async function getCoursePromptResolution({
  canCreateGeneration,
  prompt,
}: {
  canCreateGeneration: boolean;
  prompt: CoursePromptWithCourse;
}): Promise<CoursePromptResolution> {
  if (prompt.intent === "learn" && isRegularCourseFormat(prompt.courseFormat)) {
    const course = await getReusableCourseForCoursePrompt(prompt);

    if (course) {
      return { course, kind: "course" };
    }
  }

  if (canGenerateCoursePrompt(prompt)) {
    if (!canCreateGeneration) {
      return { kind: "unauthorized" };
    }

    await enableCoursePromptGeneration(prompt);

    return {
      kind: "generate",
      prompt: {
        canonicalTitle: prompt.canonicalTitle,
        courseFormat: prompt.courseFormat,
        id: prompt.id,
        intent: prompt.intent,
      },
    };
  }

  if (prompt.intent === "learn" && prompt.courseFormat === "language") {
    return { kind: "language" };
  }

  if (prompt.intent === "exam") {
    return { kind: "exam" };
  }

  if (prompt.intent === "unsafe") {
    return { kind: "unsafe" };
  }

  return {
    kind: "unsupported",
    prompt: { courseFormat: prompt.courseFormat, intent: prompt.intent },
    title: prompt.canonicalTitle ?? prompt.prompt,
  };
}

/**
 * Falls back to the learner prompt when the model returns an empty title. The
 * schema guarantees a string, but it cannot guarantee a useful non-empty title.
 */
function getResolvedTitle({ prompt, title }: { prompt: string; title: string }): string {
  const trimmedTitle = title.trim();

  if (trimmedTitle) {
    return trimmedTitle;
  }

  return prompt.trim();
}

/**
 * Keeps the format classifier as a parallel helper. Its answer is useful only
 * when a learning prompt can become a shared course. Other supported intents
 * persist the matching future course family directly.
 */
function getCourseFormatForPrompt({
  courseFormat,
  intent,
  requiresPersonalization,
}: {
  courseFormat: ClassifiedCourseFormat;
  intent: CourseIntent;
  requiresPersonalization: boolean;
}): PersistedCourseFormat {
  if (intent === "unsafe") {
    return null;
  }

  if (intent === "exam" || intent === "question") {
    return intent;
  }

  if (intent === "ambiguous" || requiresPersonalization) {
    return "personalized";
  }

  return courseFormat;
}

/**
 * Only prompts that can enter today's course-generation workflow receive a
 * generation status. Waitlist, redirect, and blocked prompts are fully handled
 * once the classification decision is stored.
 */
function getGenerationStatusForCoursePrompt(
  prompt: Pick<CoursePromptInput, "courseFormat" | "intent" | "targetLanguage">,
): CoursePromptInput["generationStatus"] {
  if (canGenerateCoursePrompt(prompt)) {
    return "pending";
  }

  return null;
}

/**
 * Stores or reuses the prompt classification. The unique prompt cache can be
 * hit by concurrent first visits, so this keeps the first persisted decision
 * instead of letting the second request fail.
 */
async function upsertCoursePrompt({
  language,
  prompt,
  request,
}: {
  language: string;
  prompt: string;
  request: CoursePromptInput;
}): Promise<CoursePromptWithCourse> {
  const normalizedPrompt = normalizeString(prompt);

  try {
    return await prisma.coursePrompt.upsert({
      create: {
        canonicalTitle: request.canonicalTitle,
        courseFormat: request.courseFormat,
        generationStatus: request.generationStatus,
        intent: request.intent,
        language,
        normalizedPrompt,
        prompt,
        targetLanguage: request.targetLanguage,
      },
      include: { course: true },
      update: {},
      where: { languageNormalizedPrompt: { language, normalizedPrompt } },
    });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const cachedPrompt = await findCachedCoursePrompt({ language, prompt });

    if (!cachedPrompt) {
      throw error;
    }

    return cachedPrompt;
  }
}

/**
 * Builds the fields for a newly classified prompt, including the generation
 * status an authenticated request should receive. Guest persistence clears
 * that status separately so classification never starts generation by itself.
 */
function getClassifiedCoursePromptInput({
  courseFormat,
  intent,
  prompt,
  title,
}: {
  courseFormat: PersistedCourseFormat;
  intent: PromptIntent;
  prompt: string;
  title: string;
}): CoursePromptInput {
  const input = {
    canonicalTitle: intent === "unsafe" ? null : getResolvedTitle({ prompt, title }),
    courseFormat,
    intent,
    targetLanguage: null,
  };

  return { ...input, generationStatus: getGenerationStatusForCoursePrompt(input) };
}

/**
 * Stores guest classifications without marking them ready for generation. An
 * authenticated revisit promotes the same row to pending at the generation
 * boundary, preserving guest demand data without starting course work.
 */
function getPersistedCoursePromptInput({
  canCreateGeneration,
  prompt,
}: {
  canCreateGeneration: boolean;
  prompt: CoursePromptInput;
}): CoursePromptInput {
  return { ...prompt, generationStatus: canCreateGeneration ? prompt.generationStatus : null };
}

/**
 * Runs every independent classification task in one model wave. Persistence is
 * handled separately so the same decision can be stored for every learner
 * without coupling classification to generation access.
 */
async function classifyNewCoursePrompt({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): Promise<CoursePromptInput> {
  const [intent, personalization, formatClassification, canonicalTitle] = await Promise.all([
    classifyCourseIntent({ prompt }),
    classifyCoursePersonalization({ prompt }),
    classifyCourseFormat({ prompt }),
    generateCanonicalCourseTitle({ language, prompt }),
  ]);

  const courseFormat = getCourseFormatForPrompt({
    courseFormat: formatClassification.data.courseFormat,
    intent: intent.data.intent,
    requiresPersonalization: personalization.data.requiresPersonalization,
  });

  return getClassifiedCoursePromptInput({
    courseFormat,
    intent: intent.data.intent,
    prompt,
    title: canonicalTitle.data.title,
  });
}

/**
 * Resolves a learner's free-text goal into the next domain capability.
 * Cached existing-course and classification outcomes remain public because
 * they cannot create generation work. First-time prompts run classification in
 * memory for every learner so public redirects and waitlists remain available.
 * Every valid classification is persisted for demand analysis, while new or
 * cached prompts still require a trusted session before course generation can
 * be marked pending or begin.
 */
export async function resolveCoursePrompt({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): Promise<CoursePromptResolution> {
  const inputError = getCoursePromptInputError({ language, prompt });

  if (inputError) {
    return { kind: "invalid", reason: inputError };
  }

  const [cachedPrompt, session] = await Promise.all([
    findCachedCoursePrompt({ language, prompt }),
    getSession(),
  ]);

  if (cachedPrompt) {
    return getCoursePromptResolution({
      canCreateGeneration: Boolean(session),
      prompt: cachedPrompt,
    });
  }

  const classifiedPrompt = await classifyNewCoursePrompt({ language, prompt });
  const canCreateGeneration = Boolean(session);

  const coursePrompt = await upsertCoursePrompt({
    language,
    prompt,
    request: getPersistedCoursePromptInput({ canCreateGeneration, prompt: classifiedPrompt }),
  });

  return getCoursePromptResolution({ canCreateGeneration, prompt: coursePrompt });
}
