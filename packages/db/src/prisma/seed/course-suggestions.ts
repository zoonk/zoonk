import { normalizeString } from "@zoonk/utils/string";
import type { PrismaClient } from "../../generated/prisma/client";

export async function seedCourseSuggestions(
  prisma: PrismaClient,
): Promise<void> {
  // Seed course suggestions for predictable E2E tests
  await prisma.courseSuggestion.upsert({
    create: {
      locale: "en",
      prompt: normalizeString("test prompt"),
      suggestions: [
        {
          description: "Learn the fundamentals of software testing",
          title: "Introduction to Testing",
        },
        {
          description: "Master complex testing patterns and methodologies",
          title: "Advanced Test Strategies",
        },
      ],
    },
    update: {},
    where: {
      localePrompt: { locale: "en", prompt: normalizeString("test prompt") },
    },
  });

  await prisma.courseSuggestion.upsert({
    create: {
      locale: "pt",
      prompt: normalizeString("test prompt"),
      suggestions: [
        {
          description: "Aprenda os fundamentos de testes de software",
          title: "Introdução a Testes",
        },
        {
          description: "Domine padrões e metodologias complexas de testes",
          title: "Estratégias Avançadas de Testes",
        },
      ],
    },
    update: {},
    where: {
      localePrompt: { locale: "pt", prompt: normalizeString("test prompt") },
    },
  });
}
