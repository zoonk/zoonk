import { randomUUID } from "node:crypto";
import { type CourseSuggestion, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

const UUID_SHORT_LENGTH = 8;

function courseSuggestionAttrs(
  attrs?: Partial<CourseSuggestion>,
): Omit<CourseSuggestion, "id" | "createdAt" | "updatedAt"> {
  return {
    description: "Test course suggestion description",
    generationRunId: null,
    generationStatus: "pending",
    language: "en",
    slug: `test-suggestion-${randomUUID()}`,
    targetLanguage: null,
    title: "Test Course Suggestion",
    ...attrs,
  };
}

export async function courseSuggestionFixture(attrs?: Partial<CourseSuggestion>) {
  const suggestion = await prisma.courseSuggestion.create({
    data: courseSuggestionAttrs(attrs),
  });
  return suggestion;
}

export async function searchPromptWithSuggestionsFixture(attrs?: {
  language?: string;
  prompt?: string;
  suggestions?: Partial<CourseSuggestion>[];
}) {
  const language = attrs?.language ?? "en";
  const uniqueId = randomUUID().slice(0, UUID_SHORT_LENGTH);
  const prompt = attrs?.prompt ?? `e2e prompt ${uniqueId}`;

  const suggestionsData = attrs?.suggestions ?? [
    {
      description: `Fundamentals of ${prompt} ${uniqueId}`,
      title: `Introduction to ${prompt} ${uniqueId}`,
    },
    {
      description: `Advanced patterns for ${prompt} ${uniqueId}`,
      title: `Advanced ${prompt} ${uniqueId}`,
    },
  ];

  const suggestions = await Promise.all(
    suggestionsData.map((data) => courseSuggestionFixture({ language, ...data })),
  );

  const searchPrompt = await prisma.searchPrompt.create({
    data: { language, prompt: normalizeString(prompt) },
  });

  await Promise.all(
    suggestions.map((suggestion, idx) =>
      prisma.searchPromptSuggestion.create({
        data: {
          courseSuggestionId: suggestion.id,
          position: idx,
          searchPromptId: searchPrompt.id,
        },
      }),
    ),
  );

  return { prompt, searchPrompt, suggestions };
}
