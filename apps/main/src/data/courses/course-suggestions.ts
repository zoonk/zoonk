import "server-only";
import { generateCourseSuggestions as generateTask } from "@zoonk/ai/tasks/courses/suggestions";
import { type CourseSuggestion, getAiGenerationCourseWhere, prisma } from "@zoonk/db";
import { getLanguageName, isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { normalizeString, removeLocaleSuffix, toSlug } from "@zoonk/utils/string";
import { isUuid } from "@zoonk/utils/uuid";

type SuggestionResult = Pick<CourseSuggestion, "id" | "title" | "description" | "targetLanguage">;

async function findSearchPrompt(params: { language: string; prompt: string }) {
  const { language, prompt: rawPrompt } = params;
  const prompt = normalizeString(rawPrompt);

  return prisma.searchPrompt.findUnique({
    include: { suggestions: { include: { courseSuggestion: true }, orderBy: { position: "asc" } } },
    where: { languagePrompt: { language, prompt } },
  });
}

type SuggestionInput = { title: string; description: string; targetLanguage: string | null };

type GeneratedSuggestion = {
  description: string;
  targetLanguageCode: string | null;
  title: string;
};

async function upsertSearchPromptWithSuggestions(input: {
  language: string;
  prompt: string;
  suggestions: SuggestionInput[];
}): Promise<{ id: string; suggestions: SuggestionResult[] }> {
  const { language, prompt: rawPrompt, suggestions } = input;
  const prompt = normalizeString(rawPrompt);

  return prisma.$transaction(async (tx) => {
    const searchPrompt = await tx.searchPrompt.upsert({
      create: { language, prompt },
      update: {},
      where: { languagePrompt: { language, prompt } },
    });

    const results = await Promise.all(
      suggestions.map(async (suggestion, idx) => {
        const slug = toSlug(suggestion.title);

        const courseSuggestion = await tx.courseSuggestion.upsert({
          create: {
            description: suggestion.description,
            language,
            slug,
            targetLanguage: suggestion.targetLanguage,
            title: suggestion.title,
          },
          update: {},
          where: { languageSlug: { language, slug } },
        });

        await tx.searchPromptSuggestion.upsert({
          create: {
            courseSuggestionId: courseSuggestion.id,
            position: idx,
            searchPromptId: searchPrompt.id,
          },
          update: { position: idx },
          where: {
            promptSuggestion: {
              courseSuggestionId: courseSuggestion.id,
              searchPromptId: searchPrompt.id,
            },
          },
        });

        return {
          description: courseSuggestion.description,
          id: courseSuggestion.id,
          targetLanguage: courseSuggestion.targetLanguage,
          title: courseSuggestion.title,
        };
      }),
    );

    return { id: searchPrompt.id, suggestions: results };
  });
}

/**
 * Normalizes model-generated language codes before we treat a suggestion as a
 * language course. The prompt asks for ISO 639-1 codes, but model output is
 * still untrusted: values such as `zh-TW`, `traditional-chinese`, or the raw
 * learner input can otherwise reach `Intl.DisplayNames` and crash the page with
 * `RangeError: invalid_argument`.
 */
function normalizeGeneratedTargetLanguage({
  targetLanguageCode,
}: {
  targetLanguageCode: string | null;
}): string | null {
  const language = getBaseLanguageCode({ targetLanguageCode });

  if (!language || !isTTSSupportedLanguage(language)) {
    return null;
  }

  return language;
}

/**
 * Extracts the base language subtag from BCP 47-like model output. Region and
 * script variants such as `zh-Hant-TW` still describe the same app-level target
 * language, while malformed values should become `null` so the suggestion stays
 * a normal course suggestion instead of crashing.
 */
function getBaseLanguageCode({
  targetLanguageCode,
}: {
  targetLanguageCode: string | null;
}): string | null {
  if (!targetLanguageCode) {
    return null;
  }

  try {
    return new Intl.Locale(targetLanguageCode.trim()).language ?? null;
  } catch {
    return null;
  }
}

/**
 * Converts one AI suggestion into the database shape we trust. Language-course
 * suggestions get a deterministic localized title from our language utilities;
 * malformed language codes stay as ordinary course suggestions with the model's
 * original title and a null target language.
 */
function resolveLanguageSuggestion({
  language,
  suggestion,
}: {
  language: string;
  suggestion: GeneratedSuggestion;
}): SuggestionInput {
  const targetLanguage = normalizeGeneratedTargetLanguage({
    targetLanguageCode: suggestion.targetLanguageCode,
  });

  if (!targetLanguage) {
    return { description: suggestion.description, targetLanguage: null, title: suggestion.title };
  }

  const title = getLanguageName({ targetLanguage, userLanguage: language });

  return { description: suggestion.description, targetLanguage, title };
}

function deduplicateByTargetLanguage(suggestions: SuggestionInput[]): SuggestionInput[] {
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    if (!suggestion.targetLanguage) {
      return true;
    }

    if (seen.has(suggestion.targetLanguage)) {
      return false;
    }

    seen.add(suggestion.targetLanguage);
    return true;
  });
}

export async function generateCourseSuggestions({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): Promise<{ id: string; suggestions: SuggestionResult[] }> {
  const record = await findSearchPrompt({ language, prompt });

  if (record && record.suggestions.length > 0) {
    return {
      id: record.id,
      suggestions: record.suggestions.map((link) => ({
        description: link.courseSuggestion.description,
        id: link.courseSuggestion.id,
        targetLanguage: link.courseSuggestion.targetLanguage,
        title: link.courseSuggestion.title,
      })),
    };
  }

  const { data } = await generateTask({ language, prompt });

  const resolved = data.map((suggestion) => resolveLanguageSuggestion({ language, suggestion }));
  const deduplicated = deduplicateByTargetLanguage(resolved);

  return upsertSearchPromptWithSuggestions({ language, prompt, suggestions: deduplicated });
}

/**
 * Course suggestion pages render a 404 when the suggestion lookup returns
 * `null`. Returning `null` for malformed ids preserves that behavior for bad
 * route params instead of surfacing a Prisma UUID parsing error.
 */
export async function getCourseSuggestionById(id: string): Promise<CourseSuggestion | null> {
  if (!isUuid(id)) {
    return null;
  }

  return prisma.courseSuggestion.findUnique({ where: { id } });
}

/**
 * Loads the AI-catalog course already chosen for a suggestion. Course identity
 * resolution happens in the generation workflow, and server pages use this link
 * to avoid repeating semantic duplicate checks during render.
 */
export async function getLinkedCourseForSuggestion({
  courseId,
}: Pick<CourseSuggestion, "courseId">) {
  if (!courseId) {
    return null;
  }

  return prisma.course.findFirst({ where: getAiGenerationCourseWhere({ id: courseId }) });
}

export async function getCourseSuggestionBySlug({
  slug,
  language,
}: {
  slug: string;
  language: string;
}): Promise<CourseSuggestion | null> {
  const normalizedSlug = removeLocaleSuffix(slug, language);

  return prisma.courseSuggestion.findUnique({
    where: { languageSlug: { language, slug: normalizedSlug } },
  });
}
