import { randomUUID } from "node:crypto";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, test } from "vitest";
import { fetchExistingWordCasing } from "./fetch-existing-word-casing";

describe(fetchExistingWordCasing, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  test("returns empty object when no words match", async () => {
    const result = await fetchExistingWordCasing({
      organizationId,
      targetLanguage: "es",
      words: [`nonexistent-${randomUUID()}`],
    });

    expect(result).toEqual({});
  });

  test("returns lowercase-to-original casing map for existing words", async () => {
    const id = randomUUID().slice(0, 8);
    const originalCasing = `Hola${id}`;

    await wordFixture({
      organizationId,
      targetLanguage: "es",
      word: originalCasing,
    });

    const result = await fetchExistingWordCasing({
      organizationId,
      targetLanguage: "es",
      words: [originalCasing.toLowerCase()],
    });

    expect(result).toEqual({ [originalCasing.toLowerCase()]: originalCasing });
  });

  test("matches case-insensitively", async () => {
    const id = randomUUID().slice(0, 8);
    const originalCasing = `Buenos${id}`;

    await wordFixture({
      organizationId,
      targetLanguage: "es",
      word: originalCasing,
    });

    const result = await fetchExistingWordCasing({
      organizationId,
      targetLanguage: "es",
      words: [originalCasing.toUpperCase()],
    });

    expect(result).toEqual({ [originalCasing.toLowerCase()]: originalCasing });
  });

  test("returns multiple words when several match", async () => {
    const id = randomUUID().slice(0, 8);
    const word1 = `Gato${id}`;
    const word2 = `Perro${id}`;

    await Promise.all([
      wordFixture({ organizationId, targetLanguage: "es", word: word1 }),
      wordFixture({ organizationId, targetLanguage: "es", word: word2 }),
    ]);

    const result = await fetchExistingWordCasing({
      organizationId,
      targetLanguage: "es",
      words: [word1.toLowerCase(), word2.toLowerCase()],
    });

    expect(result).toEqual({
      [word1.toLowerCase()]: word1,
      [word2.toLowerCase()]: word2,
    });
  });

  test("does not match words from a different target language", async () => {
    const id = randomUUID().slice(0, 8);
    const word = `Bonjour${id}`;

    await wordFixture({
      organizationId,
      targetLanguage: "fr",
      word,
    });

    const result = await fetchExistingWordCasing({
      organizationId,
      targetLanguage: "de",
      words: [word.toLowerCase()],
    });

    expect(result).toEqual({});
  });
});
