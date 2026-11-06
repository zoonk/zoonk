import { randomUUID } from "node:crypto";
import { generateLessonIconImage } from "@zoonk/ai/tasks/icons/image";
import { prisma } from "@zoonk/db";
import { lessonIconFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import { blankIcon, drawnIcon } from "./_test-utils/icon-images";
import {
  claimLessonIcons,
  drawLessonIcon,
  failLessonIcon,
  searchIconCandidates,
} from "./lesson-icon-library";

function randomWord() {
  return `zq${randomUUID().replaceAll(/[\d-]/gu, "").slice(0, 10)}`;
}

function needFor(name: string, searchWords: string[] = []) {
  return { description: `A drawing of a ${name}`, name, searchWords };
}

async function claimOne(need: ReturnType<typeof needFor>, runId: string = randomUUID()) {
  const [claim] = await claimLessonIcons({ needs: [need], runId });

  if (!claim) {
    throw new Error(`No row for ${need.name}`);
  }

  return claim;
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

describe(claimLessonIcons, () => {
  it("gives a new name to one claim when two lessons ask at once, and both get the same running row", async () => {
    const need = needFor(`${randomWord()} stamp`);

    const [first, second] = await Promise.all([claimOne(need), claimOne(need)]);

    expect([first.claimed, second.claimed].filter(Boolean)).toHaveLength(1);
    expect(second.iconId).toBe(first.iconId);

    await expect(
      prisma.lessonIcon.findMany({ select: { status: true }, where: { name: need.name } }),
    ).resolves.toStrictEqual([{ status: "running" }]);
  });

  it("gives a retried claim back the names its first try saved before the step failed", async () => {
    const [need, runId] = [needFor(`${randomWord()} gavel`), randomUUID()];

    vi.spyOn(prisma.lessonIcon, "findMany").mockRejectedValueOnce(new Error("Connection lost"));

    await expect(claimOne(need, runId)).rejects.toThrow("Connection lost");
    await expect(claimOne(need, runId)).resolves.toMatchObject({ claimed: true });
  });
});

describe(drawLessonIcon, () => {
  beforeEach(() => {
    storeBlobUploads();
  });

  it("draws a claimed name into its two files and completes its row, and a replayed step draws nothing more", async () => {
    const need = needFor(`${randomWord()} bank`);
    const { iconId } = await claimOne(need);

    vi.mocked(generateLessonIconImage).mockResolvedValue(
      (await drawnImage(await drawnIcon())) as never,
    );

    await drawLessonIcon({ iconId, need });
    await drawLessonIcon({ iconId, need });

    expect(generateLessonIconImage).toHaveBeenCalledOnce();

    await expect(
      prisma.lessonIcon.findUniqueOrThrow({ where: { name: need.name } }),
    ).resolves.toMatchObject({
      id: iconId,
      model: "openai/gpt-image-2.5-flare",
      smallUrl: expect.stringContaining("-96.webp"),
      status: "completed",
      url: expect.stringContaining("-256.webp"),
    });
  });

  it("throws on a file code can't use, so its step retries, and records the name as failed afterward so no lesson claims it again", async () => {
    const need = needFor(`${randomWord()} glass`);
    const { iconId } = await claimOne(need);

    vi.mocked(generateLessonIconImage).mockResolvedValue(
      (await drawnImage(await blankIcon())) as never,
    );

    await expect(drawLessonIcon({ iconId, need })).rejects.toThrow("no drawing");
    await failLessonIcon(iconId);

    await expect(
      prisma.lessonIcon.findUniqueOrThrow({ select: { status: true }, where: { id: iconId } }),
    ).resolves.toStrictEqual({ status: "failed" });

    await expect(claimOne(need)).resolves.toStrictEqual({ claimed: false, iconId, need });
  });
});
