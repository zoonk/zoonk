import type { PrismaClient } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

const SUGGESTIONS_EN = [
  {
    description: "Learn the fundamentals of software testing",
    title: "Introduction to Testing",
  },
  {
    description: "Master complex testing patterns and methodologies",
    title: "Advanced Test Strategies",
  },
];

const SUGGESTIONS_PT = [
  {
    description: "Aprenda os fundamentos de testes de software",
    title: "Introdução a Testes",
  },
  {
    description: "Domine padrões e metodologias complexas de testes",
    title: "Estratégias Avançadas de Testes",
  },
];

export async function seedCourseSuggestions(
  prisma: PrismaClient,
): Promise<void> {
  // Seed course suggestions for predictable E2E tests
  await prisma.courseSuggestion.upsert({
    create: {
      locale: "en",
      prompt: normalizeString("test prompt"),
      suggestions: SUGGESTIONS_EN,
    },
    update: {
      suggestions: SUGGESTIONS_EN,
    },
    where: {
      localePrompt: { locale: "en", prompt: normalizeString("test prompt") },
    },
  });

  await prisma.courseSuggestion.upsert({
    create: {
      locale: "pt",
      prompt: normalizeString("test prompt"),
      suggestions: SUGGESTIONS_PT,
    },
    update: {
      suggestions: SUGGESTIONS_PT,
    },
    where: {
      localePrompt: { locale: "pt", prompt: normalizeString("test prompt") },
    },
  });
}
