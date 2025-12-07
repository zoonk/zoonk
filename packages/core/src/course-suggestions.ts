import "server-only";

import { generateCourseSuggestions } from "@zoonk/ai/course-suggestions";
import { prisma } from "@zoonk/db";
import { cacheTagCourseSuggestions } from "@zoonk/utils/cache";
import { normalizeString } from "@zoonk/utils/string";
import { cacheLife, cacheTag } from "next/cache";

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

export async function upsertCourseSuggestion(input: {
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

export async function getCourseSuggestions({
  locale,
  prompt,
}: {
  locale: string;
  prompt: string;
}): Promise<Suggestion[]> {
  "use cache";
  cacheLife("max");
  cacheTag(locale, cacheTagCourseSuggestions({ prompt }));

  const record = await findCourseSuggestion({ locale, prompt });

  if (!record) {
    const { data } = await generateCourseSuggestions({ locale, prompt });

    await upsertCourseSuggestion({ locale, prompt, suggestions: data });

    return data;
  }

  return record.suggestions as Suggestion[];
}
