import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import {
  type GeneratedWordMetadata,
  saveGeneratedWordMetadata,
} from "./save-generated-word-metadata";

/** Creates the smallest reusable word input needed to exercise word identity. */
function getWordMetadata(word: string): GeneratedWordMetadata {
  return { audioUrl: null, pronunciation: null, romanization: null, romanizationUpdate: {}, word };
}

describe(saveGeneratedWordMetadata, () => {
  it("preserves case-distinct words as separate reusable vocabulary", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const suffix = randomUUID().slice(0, 8);
    const uppercaseWord = `Hola-${suffix}`;
    const lowercaseWord = uppercaseWord.toLowerCase();

    const wordIds = await saveGeneratedWordMetadata({
      organizationId: organization.id,
      targetLanguage: "es",
      userLanguage: "en",
      words: [getWordMetadata(uppercaseWord), getWordMetadata(lowercaseWord)],
    });

    const words = await prisma.word.findMany({
      where: {
        organizationId: organization.id,
        targetLanguage: "es",
        word: { in: [uppercaseWord, lowercaseWord] },
      },
    });

    expect(words).toHaveLength(2);
    expect(wordIds[uppercaseWord]).not.toBe(wordIds[lowercaseWord]);
  });
});
