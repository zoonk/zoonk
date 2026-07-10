import "server-only";
import { generateCanonicalCourseTitle } from "@zoonk/ai/tasks/courses/canonical-title";
import {
  type CourseFormat as ClassifiedCourseFormat,
  classifyCourseFormat,
} from "@zoonk/ai/tasks/courses/format";
import { type CourseIntent, classifyCourseIntent } from "@zoonk/ai/tasks/courses/intent";
import { classifyCoursePersonalization } from "@zoonk/ai/tasks/courses/personalization";
import { type CoursePrompt, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { isUuid } from "@zoonk/utils/uuid";
import {
  type CoursePromptWithCourse,
  getReusableCourseHrefForCoursePrompt,
} from "./_utils/course-prompt-reusable-course";
import { type AiCourseHref } from "./course-href";

type PromptIntent = CoursePrompt["intent"];
type PersistedCourseFormat = CoursePrompt["courseFormat"];
type UnsupportedPromptIntent = Extract<PromptIntent, "ambiguous" | "learn" | "question">;

export type UnsupportedCoursePrompt = {
  courseFormat: PersistedCourseFormat;
  intent: UnsupportedPromptIntent;
};

export type CoursePromptResolution =
  | { href: AiCourseHref; kind: "course" }
  | {
      kind: "generate";
      prompt: Pick<CoursePrompt, "canonicalTitle" | "courseFormat" | "id" | "intent">;
    }
  | { kind: "redirect"; href: "/start/speak" }
  | { kind: "redirect"; href: "/start/exam" }
  | { kind: "unsafe" }
  | { kind: "unsupported"; prompt: UnsupportedCoursePrompt; title: string };

type CoursePromptInput = Pick<
  CoursePrompt,
  "canonicalTitle" | "courseFormat" | "generationStatus" | "intent" | "targetLanguage"
>;

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
 * Keeps the supported-generation check in one place. `core` courses use the
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

  if (courseFormat === "core") {
    return true;
  }

  return courseFormat === "language" && Boolean(targetLanguage);
}

/**
 * Converts a persisted prompt into route behavior. This mapping is reused for
 * cached and new prompts so first submissions and repeat visits cannot drift.
 */
async function getCoursePromptResolution(
  prompt: CoursePromptWithCourse,
): Promise<CoursePromptResolution> {
  if (prompt.intent === "learn" && prompt.courseFormat === "core") {
    const href = await getReusableCourseHrefForCoursePrompt(prompt);

    if (href) {
      return { href, kind: "course" };
    }
  }

  if (canGenerateCoursePrompt(prompt)) {
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
    return { href: "/start/speak", kind: "redirect" };
  }

  if (prompt.intent === "exam") {
    return { href: "/start/exam", kind: "redirect" };
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
 * Builds the persisted prompt fields for a newly classified prompt. Keeping the
 * mapper separate makes the launch limitation explicit: only shared-learning
 * core and concrete language prompts are sent to generation today.
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
 * Finds a generation prompt by id. The generation page uses this instead of a
 * suggestion lookup, which keeps the browser and workflow aligned on the prompt
 * boundary.
 */
export async function getCoursePromptById(id: string): Promise<CoursePromptWithCourse | null> {
  if (!isUuid(id)) {
    return null;
  }

  return prisma.coursePrompt.findUnique({ include: { course: true }, where: { id } });
}

/**
 * Resolves a `/start/learn` prompt into the next product surface. First-time
 * prompts run intent, personalization, format, and title tasks in one model
 * wave so the UI can later use every decision without adding latency today.
 */
export async function resolveCoursePrompt({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): Promise<CoursePromptResolution> {
  const cachedPrompt = await findCachedCoursePrompt({ language, prompt });

  if (cachedPrompt) {
    return getCoursePromptResolution(cachedPrompt);
  }

  // Start every independent task in one model wave to minimize routing latency.
  // Some results are intentionally discarded after intent determines the route.
  const [intent, personalization, formatClassification, canonicalTitle] = await Promise.all([
    classifyCourseIntent({ language, prompt }),
    classifyCoursePersonalization({ language, prompt }),
    classifyCourseFormat({ language, prompt }),
    generateCanonicalCourseTitle({ language, prompt }),
  ]);

  const courseFormat = getCourseFormatForPrompt({
    courseFormat: formatClassification.data.courseFormat,
    intent: intent.data.intent,
    requiresPersonalization: personalization.data.requiresPersonalization,
  });

  const coursePrompt = await upsertCoursePrompt({
    language,
    prompt,
    request: getClassifiedCoursePromptInput({
      courseFormat,
      intent: intent.data.intent,
      prompt,
      title: canonicalTitle.data.title,
    }),
  });

  return getCoursePromptResolution(coursePrompt);
}
