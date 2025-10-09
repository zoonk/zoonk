import "server-only";

import prisma from "@/lib/prisma";
import { normalizeString } from "@/lib/utils";

export type Suggestion = {
  title: string;
  description: string;
};

export async function addCourseSuggestion(input: {
  locale: string;
  prompt: string;
  suggestions: Suggestion[];
}) {
  const { locale, prompt: rawPrompt, suggestions } = input;
  const prompt = normalizeString(rawPrompt);

  return prisma.courseSuggestion.upsert({
    where: { locale_prompt: { locale, prompt } },
    update: { suggestions },
    create: { locale, prompt, suggestions },
  });
}

export async function getCourseSuggestion(params: {
  locale: string;
  prompt: string;
}) {
  const { locale, prompt: rawPrompt } = params;
  const prompt = normalizeString(rawPrompt);

  return prisma.courseSuggestion.findUnique({
    where: { locale_prompt: { locale, prompt } },
  });
}
