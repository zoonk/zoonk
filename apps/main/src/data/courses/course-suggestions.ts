import "server-only";

import { generateCourseSuggestions as generateTask } from "@zoonk/ai/course-suggestions/generate";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

type Suggestion = {
  title: string;
  description: string;
};

async function findCourseSuggestion(params: {
  locale: string;
  prompt: string;
}) {
  const { locale, prompt: rawPrompt } = params;
  const prompt = normalizeString(rawPrompt);

  return prisma.courseSuggestion.findUnique({
    where: { localePrompt: { locale, prompt } },
  });
}

async function upsertCourseSuggestion(input: {
  locale: string;
  prompt: string;
  suggestions: Suggestion[];
}) {
  const { locale, prompt: rawPrompt, suggestions } = input;
  const prompt = normalizeString(rawPrompt);

  return prisma.courseSuggestion.upsert({
    create: { locale, prompt, suggestions },
    update: { suggestions },
    where: { localePrompt: { locale, prompt } },
  });
}

export async function generateCourseSuggestions({
  locale,
  prompt,
}: {
  locale: string;
  prompt: string;
}): Promise<{ id: number; suggestions: Suggestion[] }> {
  const record = await findCourseSuggestion({ locale, prompt });

  if (!record) {
    const { data } = await generateTask({ locale, prompt });

    const newRecord = await upsertCourseSuggestion({
      locale,
      prompt,
      suggestions: data,
    });

    return { id: newRecord.id, suggestions: data };
  }

  return { id: record.id, suggestions: record.suggestions as Suggestion[] };
}

export async function getCourseSuggestionById(id: number): Promise<{
  locale: string;
  prompt: string;
  suggestions: Suggestion[];
} | null> {
  const record = await prisma.courseSuggestion.findUnique({
    select: { locale: true, prompt: true, suggestions: true },
    where: { id },
  });

  if (!record) {
    return null;
  }

  return {
    locale: record.locale,
    prompt: record.prompt,
    suggestions: record.suggestions as Suggestion[],
  };
}
