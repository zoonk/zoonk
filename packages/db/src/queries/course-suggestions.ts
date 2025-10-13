import "server-only";

import { normalizeString } from "@zoonk/utils/string";
import { prisma } from "../index";

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
