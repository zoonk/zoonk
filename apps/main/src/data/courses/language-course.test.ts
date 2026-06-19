import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { getOrCreateLanguageCourseSuggestion } from "./language-course";

describe(getOrCreateLanguageCourseSuggestion, () => {
  it("does not reuse unrelated prompt suggestions with the same target language", async () => {
    const language = `x${randomUUID().slice(0, 8)}`;
    const targetLanguage = "es";
    const uniqueId = randomUUID();

    const unrelated = await prisma.courseSuggestion.create({
      data: {
        description: `Unrelated Spanish exam ${uniqueId}`,
        language,
        slug: `spanish-exam-${uniqueId}`,
        targetLanguage,
        title: `Spanish exam ${uniqueId}`,
      },
    });

    const suggestion = await getOrCreateLanguageCourseSuggestion({
      description: `Learn Spanish from scratch ${uniqueId}`,
      language,
      targetLanguage,
      title: `Spanish ${uniqueId}`,
    });

    expect(suggestion.id).not.toBe(unrelated.id);

    expect(suggestion).toMatchObject({
      description: `Learn Spanish from scratch ${uniqueId}`,
      language,
      slug: "language-es",
      targetLanguage,
      title: `Spanish ${uniqueId}`,
    });
  });

  it("reuses the controlled language-start suggestion", async () => {
    const language = `x${randomUUID().slice(0, 8)}`;
    const targetLanguage = "fr";
    const uniqueId = randomUUID();

    const existing = await prisma.courseSuggestion.create({
      data: {
        description: `Existing French ${uniqueId}`,
        language,
        slug: "language-fr",
        targetLanguage,
        title: `French ${uniqueId}`,
      },
    });

    const suggestion = await getOrCreateLanguageCourseSuggestion({
      description: `New French ${uniqueId}`,
      language,
      targetLanguage,
      title: `New French ${uniqueId}`,
    });

    expect(suggestion.id).toBe(existing.id);
    expect(suggestion.description).toBe(existing.description);
  });
});
