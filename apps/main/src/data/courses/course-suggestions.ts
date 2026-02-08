import "server-only";
import { generateCourseSuggestions as generateTask } from "@zoonk/ai/tasks/courses/suggestions";
import { type CourseSuggestion, prisma } from "@zoonk/db";
import { getLanguageName } from "@zoonk/utils/languages";
import { normalizeString, toSlug } from "@zoonk/utils/string";

type SuggestionResult = Pick<CourseSuggestion, "id" | "title" | "description" | "targetLanguage">;

async function findSearchPrompt(params: { language: string; prompt: string }) {
  const { language, prompt: rawPrompt } = params;
  const prompt = normalizeString(rawPrompt);

  return prisma.searchPrompt.findUnique({
    include: {
      suggestions: {
        include: { courseSuggestion: true },
        orderBy: { position: "asc" },
      },
    },
    where: { languagePrompt: { language, prompt } },
  });
}

type SuggestionInput = {
  title: string;
  description: string;
  targetLanguage: string | null;
};

async function upsertSearchPromptWithSuggestions(input: {
  language: string;
  prompt: string;
  suggestions: SuggestionInput[];
}): Promise<{ id: number; suggestions: SuggestionResult[] }> {
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

function resolveLanguageSuggestion(
  suggestion: { title: string; description: string; targetLanguageCode: string | null },
  language: string,
): SuggestionInput {
  if (!suggestion.targetLanguageCode) {
    return { description: suggestion.description, targetLanguage: null, title: suggestion.title };
  }

  const title = getLanguageName({
    targetLanguage: suggestion.targetLanguageCode,
    userLanguage: language,
  });

  return {
    description: suggestion.description,
    targetLanguage: suggestion.targetLanguageCode,
    title,
  };
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
}): Promise<{ id: number; suggestions: SuggestionResult[] }> {
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

  const resolved = data.map((item) => resolveLanguageSuggestion(item, language));
  const deduplicated = deduplicateByTargetLanguage(resolved);

  return upsertSearchPromptWithSuggestions({
    language,
    prompt,
    suggestions: deduplicated,
  });
}

export async function getCourseSuggestionById(
  id: number,
): Promise<Pick<
  CourseSuggestion,
  | "description"
  | "generationRunId"
  | "generationStatus"
  | "language"
  | "slug"
  | "targetLanguage"
  | "title"
> | null> {
  return prisma.courseSuggestion.findUnique({
    select: {
      description: true,
      generationRunId: true,
      generationStatus: true,
      language: true,
      slug: true,
      targetLanguage: true,
      title: true,
    },
    where: { id },
  });
}

export async function getCourseSuggestionBySlug({
  slug,
  language,
}: {
  slug: string;
  language: string;
}): Promise<Pick<CourseSuggestion, "id"> | null> {
  return prisma.courseSuggestion.findUnique({
    select: { id: true },
    where: { languageSlug: { language, slug } },
  });
}
