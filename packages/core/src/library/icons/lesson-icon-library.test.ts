import { randomUUID } from "node:crypto";
import { generateLessonIconImage } from "@zoonk/ai/tasks/icons/image";
import { prisma } from "@zoonk/db";
import { lessonIconFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import { blankIcon, drawnIcon } from "./_test-utils/icon-images";
import {
  claimLessonIcon,
  drawLessonIcon,
  failLessonIcon,
  searchIconCandidates,
} from "./lesson-icon-library";

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

describe(claimLessonIcon, () => {
  it("lets one of two runs claim a new name at once, and the same run claim it again", async () => {
    const need = needFor(`rubber stamp ${randomUUID().slice(0, 8)}`.replaceAll(/\d/gu, "x"));
    const [first, second] = [`run-${randomUUID()}`, `run-${randomUUID()}`];

    const claims = await Promise.all([
      claimLessonIcon({ need, runId: first }),
      claimLessonIcon({ need, runId: second }),
    ]);

    expect(claims.filter((claim) => claim.mine)).toHaveLength(1);
    expect(new Set(claims.map((claim) => claim.id)).size).toBe(1);
    await expect(prisma.lessonIcon.count({ where: { name: need.name } })).resolves.toBe(1);

    const winner = claims.find((claim) => claim.mine)?.runId ?? "";
    await expect(claimLessonIcon({ need, runId: winner })).resolves.toMatchObject({ mine: true });
  });

  it("passes a claim whose run stopped long ago to the next run, and never a drawn or failed icon", async () => {
    const stale = await lessonIconFixture({
      smallUrl: null,
      status: "running",
      updatedAt: new Date(Date.now() - 60 * 60_000),
      url: null,
    });

    const [drawn, failed] = await Promise.all([
      lessonIconFixture(),
      lessonIconFixture({ smallUrl: null, status: "failed", url: null }),
    ]);

    const runId = `run-${randomUUID()}`;

    await expect(claimLessonIcon({ need: needFor(stale.name), runId })).resolves.toMatchObject({
      id: stale.id,
      mine: true,
    });

    await expect(claimLessonIcon({ need: needFor(drawn.name), runId })).resolves.toMatchObject({
      mine: false,
      status: "completed",
    });

    await expect(claimLessonIcon({ need: needFor(failed.name), runId })).resolves.toMatchObject({
      mine: false,
      status: "failed",
    });
  });
});

describe(searchIconCandidates, () => {
  it("finds drawn icons by any word of their name or tags, never one still being drawn", async () => {
    const word = `zq${randomUUID().replaceAll(/[\d-]/gu, "").slice(0, 10)}`;

    const [byName, byTag] = await Promise.all([
      lessonIconFixture({ name: `${word} scale`, tags: ["justice"] }),
      lessonIconFixture({ name: `courthouse ${randomUUID()}`, tags: [word, "law"] }),
      lessonIconFixture({ name: `${word} drawing`, smallUrl: null, status: "running", url: null }),
    ]);

    const other = `zq${randomUUID().replaceAll(/[\d-]/gu, "").slice(0, 10)}`;
    const found = await searchIconCandidates(needFor(`${word} ${other}`, [other]));

    expect(found.map((icon) => icon.id).toSorted()).toStrictEqual([byName.id, byTag.id].toSorted());
  });
});

describe(drawLessonIcon, () => {
  beforeEach(() => {
    storeBlobUploads();
  });

  it("draws a claimed icon into its two files once, and leaves another run's claim alone", async () => {
    const need = needFor(`piggy bank ${randomUUID().slice(0, 4)}`.replaceAll(/\d/gu, "y"));
    const runId = `run-${randomUUID()}`;
    const claim = await claimLessonIcon({ need, runId });

    vi.mocked(generateLessonIconImage).mockResolvedValue(
      (await drawnImage(await drawnIcon())) as never,
    );

    await expect(drawLessonIcon({ iconId: claim.id, runId: "other-run" })).resolves.toBe("running");
    await expect(drawLessonIcon({ iconId: claim.id, runId })).resolves.toBe("completed");
    await expect(drawLessonIcon({ iconId: claim.id, runId })).resolves.toBe("completed");

    expect(generateLessonIconImage).toHaveBeenCalledOnce();

    await expect(
      prisma.lessonIcon.findUniqueOrThrow({ where: { id: claim.id } }),
    ).resolves.toMatchObject({
      model: "openai/gpt-image-2.5-flare",
      smallUrl: expect.stringContaining("-96.webp"),
      status: "completed",
      url: expect.stringContaining("-256.webp"),
    });
  });

  it("throws on a file code can't use, so its step retries, and records the failure afterward", async () => {
    const need = needFor(`hourglass ${randomUUID().slice(0, 4)}`.replaceAll(/\d/gu, "z"));
    const runId = `run-${randomUUID()}`;
    const claim = await claimLessonIcon({ need, runId });

    vi.mocked(generateLessonIconImage).mockResolvedValue(
      (await drawnImage(await blankIcon())) as never,
    );

    await expect(drawLessonIcon({ iconId: claim.id, runId })).rejects.toThrow("no drawing");
    await failLessonIcon({ iconId: claim.id, runId });

    await expect(
      prisma.lessonIcon.findUniqueOrThrow({ where: { id: claim.id } }),
    ).resolves.toMatchObject({ status: "failed", url: null });
  });
});
