import "server-only";

import { generateCourseSuggestions as generateTask } from "@zoonk/ai/course-suggestions/generate";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

type Suggestion = {
  title: string;
  description: string;
};

async function findCourseSuggestion(params: {
  language: string;
  prompt: string;
}) {
  const { language, prompt: rawPrompt } = params;
  const prompt = normalizeString(rawPrompt);

  return prisma.courseSuggestion.findUnique({
    where: { languagePrompt: { language, prompt } },
  });
}

async function upsertCourseSuggestion(input: {
  language: string;
  prompt: string;
  suggestions: Suggestion[];
}) {
  const { language, prompt: rawPrompt, suggestions } = input;
  const prompt = normalizeString(rawPrompt);

  return prisma.courseSuggestion.upsert({
    create: { language, prompt, suggestions },
    update: { suggestions },
    where: { languagePrompt: { language, prompt } },
  });
}

export async function generateCourseSuggestions({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): Promise<{ id: number; suggestions: Suggestion[] }> {
  const record = await findCourseSuggestion({ language, prompt });

  if (!record) {
    const { data } = await generateTask({ language, prompt });

    const newRecord = await upsertCourseSuggestion({
      language,
      prompt,
      suggestions: data,
    });

    return { id: newRecord.id, suggestions: data };
  }

  return { id: record.id, suggestions: record.suggestions as Suggestion[] };
}

export async function getCourseSuggestionById(id: number): Promise<{
  language: string;
  prompt: string;
  suggestions: Suggestion[];
} | null> {
  const record = await prisma.courseSuggestion.findUnique({
    select: { language: true, prompt: true, suggestions: true },
    where: { id },
  });

  if (!record) {
    return null;
  }

  return {
    language: record.language,
    prompt: record.prompt,
    suggestions: record.suggestions as Suggestion[],
  };
}
