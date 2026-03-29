import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { describe, expect, test } from "vitest";
import { upsertWordWithPronunciation } from "./upsert-word-with-pronunciation";

describe(upsertWordWithPronunciation, () => {
  test("creates a new Word record and returns its ID", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const id = randomUUID().slice(0, 8);
    const wordText = `neko-${id}`;

    const wordId = await upsertWordWithPronunciation({
      audioUrl: "/audio/neko.mp3",
      organizationId: organization.id,
      pronunciation: null,
      romanization: "neko",
      romanizationUpdate: { romanization: "neko" },
      targetLanguage: "ja",
      userLanguage: "en",
      word: wordText,
    });

    const record = await prisma.word.findUnique({ where: { id: wordId } });

    expect(record).not.toBeNull();
    expect(record!.word).toBe(wordText);
    expect(record!.audioUrl).toBe("/audio/neko.mp3");
    expect(record!.romanization).toBe("neko");
  });

  test("creates a WordPronunciation record when pronunciation is provided", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const id = randomUUID().slice(0, 8);
    const wordText = `inu-${id}`;

    const wordId = await upsertWordWithPronunciation({
      audioUrl: null,
      organizationId: organization.id,
      pronunciation: "EE-noo",
      romanization: null,
      romanizationUpdate: {},
      targetLanguage: "ja",
      userLanguage: "en",
      word: wordText,
    });

    const pronunciations = await prisma.wordPronunciation.findMany({
      where: { wordId },
    });

    expect(pronunciations).toHaveLength(1);
    expect(pronunciations[0]!.pronunciation).toBe("EE-noo");
    expect(pronunciations[0]!.userLanguage).toBe("en");
  });

  test("does not create WordPronunciation when pronunciation is null", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const id = randomUUID().slice(0, 8);
    const wordText = `kaze-${id}`;

    const wordId = await upsertWordWithPronunciation({
      audioUrl: null,
      organizationId: organization.id,
      pronunciation: null,
      romanization: null,
      romanizationUpdate: {},
      targetLanguage: "ja",
      userLanguage: "en",
      word: wordText,
    });

    const pronunciations = await prisma.wordPronunciation.findMany({
      where: { wordId },
    });

    expect(pronunciations).toHaveLength(0);
  });

  test("updates existing Word record on conflict", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const id = randomUUID().slice(0, 8);
    const wordText = `sora-${id}`;

    const existing = await wordFixture({
      audioUrl: null,
      organizationId: organization.id,
      romanization: null,
      targetLanguage: "ja",
      word: wordText,
    });

    const wordId = await upsertWordWithPronunciation({
      audioUrl: "/audio/sora.mp3",
      organizationId: organization.id,
      pronunciation: null,
      romanization: "sora",
      romanizationUpdate: { romanization: "sora" },
      targetLanguage: "ja",
      userLanguage: "en",
      word: wordText,
    });

    expect(wordId).toBe(existing.id);

    const record = await prisma.word.findUnique({ where: { id: wordId } });

    expect(record!.audioUrl).toBe("/audio/sora.mp3");
    expect(record!.romanization).toBe("sora");
  });

  test("does not overwrite romanization when romanizationUpdate is empty", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const id = randomUUID().slice(0, 8);
    const wordText = `yama-${id}`;

    await wordFixture({
      organizationId: organization.id,
      romanization: "yama",
      targetLanguage: "ja",
      word: wordText,
    });

    const wordId = await upsertWordWithPronunciation({
      audioUrl: null,
      organizationId: organization.id,
      pronunciation: null,
      romanization: null,
      romanizationUpdate: {},
      targetLanguage: "ja",
      userLanguage: "en",
      word: wordText,
    });

    const record = await prisma.word.findUnique({ where: { id: wordId } });

    expect(record!.romanization).toBe("yama");
  });

  test("clears romanization when romanizationUpdate sets it to null", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const id = randomUUID().slice(0, 8);
    const wordText = `mizu-${id}`;

    await wordFixture({
      organizationId: organization.id,
      romanization: "mizu",
      targetLanguage: "ja",
      word: wordText,
    });

    const wordId = await upsertWordWithPronunciation({
      audioUrl: null,
      organizationId: organization.id,
      pronunciation: null,
      romanization: null,
      romanizationUpdate: { romanization: null },
      targetLanguage: "ja",
      userLanguage: "en",
      word: wordText,
    });

    const record = await prisma.word.findUnique({ where: { id: wordId } });

    expect(record!.romanization).toBeNull();
  });
});
