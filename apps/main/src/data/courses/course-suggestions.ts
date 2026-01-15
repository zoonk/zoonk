import "server-only";

import { generateCourseSuggestions as generateTask } from "@zoonk/ai/tasks/courses/suggestions";
import { type CourseSuggestion, prisma } from "@zoonk/db";
import { normalizeString, toSlug } from "@zoonk/utils/string";

type SuggestionResult = Pick<CourseSuggestion, "id" | "title" | "description">;

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

async function upsertSearchPromptWithSuggestions(input: {
  language: string;
  prompt: string;
  suggestions: Array<{ title: string; description: string }>;
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
      suggestions.map(async (suggestion, i) => {
        const slug = toSlug(suggestion.title);

        const courseSuggestion = await tx.courseSuggestion.upsert({
          create: {
            description: suggestion.description,
            language,
            slug,
            title: suggestion.title,
          },
          update: {},
          where: { languageSlug: { language, slug } },
        });

        await tx.searchPromptSuggestion.upsert({
          create: {
            courseSuggestionId: courseSuggestion.id,
            position: i,
            searchPromptId: searchPrompt.id,
          },
          update: { position: i },
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
          title: courseSuggestion.title,
        };
      }),
    );

    return { id: searchPrompt.id, suggestions: results };
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
        title: link.courseSuggestion.title,
      })),
    };
  }

  const { data } = await generateTask({ language, prompt });

  return upsertSearchPromptWithSuggestions({
    language,
    prompt,
    suggestions: data,
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
  | "title"
> | null> {
  return prisma.courseSuggestion.findUnique({
    select: {
      description: true,
      generationRunId: true,
      generationStatus: true,
      language: true,
      slug: true,
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
