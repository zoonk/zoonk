import { randomUUID } from "node:crypto";
import { generateLessonIconImage } from "@zoonk/ai/tasks/icons/image";
import { prisma } from "@zoonk/db";
import { lessonIconFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import { blankIcon, drawnIcon } from "./_test-utils/icon-images";
import { drawLessonIcon, failLessonIcon, searchIconCandidates } from "./lesson-icon-library";

function randomWord() {
  return `zq${randomUUID().replaceAll(/[\d-]/gu, "").slice(0, 10)}`;
}

function needFor(name: string, searchWords: string[] = []) {
  return { description: `A drawing of a ${name}`, name, searchWords };
}

async function drawnImage(image: Buffer) {
  return {
    data: { image: { mediaType: "image/png", uint8Array: new Uint8Array(image) } },
    prompt: "test",
    provenance: {
      generatedAt: "2026-11-05T12:00:00.000Z",
      model: "openai/gpt-image-2.5-flare",
      promptVersion: "icon-style-v1-test",
      runId: "test",
    },
  };
}

describe(searchIconCandidates, () => {
  it("finds drawn icons by any word of their name or tags, never one that failed", async () => {
    const [word, other] = [randomWord(), randomWord()];

    const [byName, byTag] = await Promise.all([
      lessonIconFixture({ name: `${word} scale`, tags: ["justice"] }),
      lessonIconFixture({ name: `courthouse ${randomWord()}`, tags: [word, "law"] }),
      lessonIconFixture({ name: `${word} drawing`, smallUrl: null, status: "failed", url: null }),
    ]);

    const found = await searchIconCandidates(needFor(`${word} ${other}`, [other]));

    expect(found.map((icon) => icon.id).toSorted()).toStrictEqual([byName.id, byTag.id].toSorted());
  });
});

describe(drawLessonIcon, () => {
  beforeEach(() => {
    storeBlobUploads();
  });

  it("draws a name the library lacks into its two files, and returns the row it has after that", async () => {
    const need = needFor(`${randomWord()} bank`);

    vi.mocked(generateLessonIconImage).mockResolvedValue(
      (await drawnImage(await drawnIcon())) as never,
    );

    const drawn = await drawLessonIcon({ need });

    await expect(drawLessonIcon({ need })).resolves.toStrictEqual(drawn);
    expect(generateLessonIconImage).toHaveBeenCalledOnce();

    await expect(
      prisma.lessonIcon.findUniqueOrThrow({ where: { id: drawn.id } }),
    ).resolves.toMatchObject({
      model: "openai/gpt-image-2.5-flare",
      smallUrl: expect.stringContaining("-96.webp"),
      status: "completed",
      url: expect.stringContaining("-256.webp"),
    });
  });

  it("keeps one row when two lessons draw the same new name at once, each paying for its drawing", async () => {
    const need = needFor(`${randomWord()} stamp`);

    vi.mocked(generateLessonIconImage).mockResolvedValue(
      (await drawnImage(await drawnIcon())) as never,
    );

    const [first, second] = await Promise.all([drawLessonIcon({ need }), drawLessonIcon({ need })]);

    expect(second.id).toBe(first.id);
    expect(generateLessonIconImage).toHaveBeenCalledTimes(2);
    await expect(prisma.lessonIcon.count({ where: { name: need.name } })).resolves.toBe(1);
  });

  it("throws on a file code can't use, so its step retries, and records the name as failed afterward", async () => {
    const need = needFor(`${randomWord()} glass`);

    vi.mocked(generateLessonIconImage).mockResolvedValue(
      (await drawnImage(await blankIcon())) as never,
    );

    await expect(drawLessonIcon({ need })).rejects.toThrow("no drawing");
    const failed = await failLessonIcon(need);

    expect(failed.status).toBe("failed");
    await expect(drawLessonIcon({ need })).resolves.toStrictEqual(failed);
    expect(generateLessonIconImage).toHaveBeenCalledOnce();
  });
});
