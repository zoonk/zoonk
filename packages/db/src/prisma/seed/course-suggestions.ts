import { normalizeString, toSlug } from "@zoonk/utils/string";
import type { PrismaClient } from "../../generated/prisma/client";

export async function seedCourseSuggestions(prisma: PrismaClient): Promise<void> {
  // English suggestions
  const enSuggestions = [
    {
      description: "Learn the fundamentals of software testing",
      title: "Introduction to Testing",
    },
    {
      description: "Master complex testing patterns and methodologies",
      title: "Advanced Test Strategies",
    },
  ];

  const enSearchPrompt = await prisma.searchPrompt.upsert({
    create: { language: "en", prompt: normalizeString("test prompt") },
    update: {},
    where: {
      languagePrompt: {
        language: "en",
        prompt: normalizeString("test prompt"),
      },
    },
  });

  await Promise.all(
    enSuggestions.map(async (suggestion, i) => {
      const slug = toSlug(suggestion.title);

      const courseSuggestion = await prisma.courseSuggestion.upsert({
        create: {
          description: suggestion.description,
          language: "en",
          slug,
          title: suggestion.title,
        },
        update: {},
        where: { languageSlug: { language: "en", slug } },
      });

      await prisma.searchPromptSuggestion.upsert({
        create: {
          courseSuggestionId: courseSuggestion.id,
          position: i,
          searchPromptId: enSearchPrompt.id,
        },
        update: { position: i },
        where: {
          promptSuggestion: {
            courseSuggestionId: courseSuggestion.id,
            searchPromptId: enSearchPrompt.id,
          },
        },
      });
    }),
  );

  // Portuguese suggestions
  const ptSuggestions = [
    {
      description: "Aprenda os fundamentos de testes de software",
      title: "Introdução a Testes",
    },
    {
      description: "Domine padrões e metodologias complexas de testes",
      title: "Estratégias Avançadas de Testes",
    },
  ];

  const ptSearchPrompt = await prisma.searchPrompt.upsert({
    create: { language: "pt", prompt: normalizeString("test prompt") },
    update: {},
    where: {
      languagePrompt: {
        language: "pt",
        prompt: normalizeString("test prompt"),
      },
    },
  });

  await Promise.all(
    ptSuggestions.map(async (suggestion, i) => {
      const slug = toSlug(suggestion.title);

      const courseSuggestion = await prisma.courseSuggestion.upsert({
        create: {
          description: suggestion.description,
          language: "pt",
          slug,
          title: suggestion.title,
        },
        update: {},
        where: { languageSlug: { language: "pt", slug } },
      });

      await prisma.searchPromptSuggestion.upsert({
        create: {
          courseSuggestionId: courseSuggestion.id,
          position: i,
          searchPromptId: ptSearchPrompt.id,
        },
        update: { position: i },
        where: {
          promptSuggestion: {
            courseSuggestionId: courseSuggestion.id,
            searchPromptId: ptSearchPrompt.id,
          },
        },
      });
    }),
  );
}
