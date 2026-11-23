import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { generateLessonIconImage } from "@zoonk/ai/tasks/icons/image";
import { checkLessonImage } from "@zoonk/ai/tasks/images/check";
import { generateLessonImage } from "@zoonk/ai/tasks/images/generate";
import { generateImageScene } from "@zoonk/ai/tasks/images/scene";
import { tagLesson } from "@zoonk/ai/tasks/lesson-marks";
import { uploadImage } from "@zoonk/core/images/upload";
import {
  type ContentFixMediaNeed,
  clipMediaKey,
  readContentFixMedia,
} from "@zoonk/core/staff/content-fixes/media-schema";
import { prisma } from "@zoonk/db";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TEST_IMAGE,
  imageProvenance,
  passedCheck,
  sceneFor,
} from "../images/_test-utils/image-results";
import { drawnIcon } from "../marks/_test-utils/icon-results";
import { backgroundTaskWorkflow } from "./background-task-workflow";

const SPEECH_PROVENANCE = {
  generatedAt: "2026-11-13T12:00:00.000Z",
  latencyMs: 1,
  model: "openai/gpt-voice",
  promptVersion: "test",
  provider: "openai",
  requestedModel: "openai/gpt-voice",
  runId: "speech-run",
  usage: {},
};

const clip = { language: "en", model: "Word", text: "rental" } as const;
const wordClip = { ...clip, key: clipMediaKey(clip), kind: "clip" } as const;

async function owedWordFix(needs: ContentFixMediaNeed[] = [wordClip]) {
  const [organization, proposer] = await Promise.all([
    organizationFixture(),
    userFixture({ role: "admin" }),
  ]);

  const word = await wordFixture({ organizationId: organization.id, targetLanguage: "en" });

  const fix = await prisma.contentFix.create({
    data: {
      batchId: randomUUID(),
      changes: [
        {
          clip: {
            after: null,
            before: {
              audioGeneratedAt: null,
              audioModel: null,
              audioPromptVersion: null,
              audioRunId: null,
              audioUrl: null,
            },
          },
          fields: [{ after: "rental", before: word.word, field: "word" }],
          id: word.id,
          model: "Word",
          op: "set",
        },
      ],
      effects: [],
      media: needs.map((need) => ({ need, result: null })),
      mediaOwedAt: new Date(),
      proposerClientId: "test",
      proposerId: proposer.id,
      reason: "Test fix",
      unit: "word",
      unitId: word.id,
    },
  });

  return { fix, proposer };
}

function mediaTask({ fixId, userId }: { fixId: string; userId: string }) {
  return backgroundTaskWorkflow({
    id: randomUUID(),
    input: { fixId },
    key: fixId,
    kind: "prepareContentFixMedia",
    revision: 0,
    userId,
  });
}

function storeUploads() {
  vi.mocked(put).mockImplementation(async (pathname) => ({
    contentDisposition: "inline",
    contentType: "application/octet-stream",
    downloadUrl: `https://blob.test/${pathname}`,
    etag: "",
    pathname,
    url: `https://blob.test/${pathname}`,
  }));
}

const picture = { key: "picture", kind: "picture", language: "en", request: "A wax seal" } as const;

function mockPictureCheck(passed: boolean) {
  vi.mocked(uploadImage).mockImplementation(async ({ fileName }) => ({
    data: `https://blob.test/${fileName}-${randomUUID()}`,
    error: null,
  }));

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(TEST_IMAGE, { headers: { "content-type": "image/webp" } })),
  );

  vi.mocked(generateImageScene).mockResolvedValue({ data: sceneFor(picture.request) } as never);

  vi.mocked(generateLessonImage).mockResolvedValue({
    data: { image: { mediaType: "image/webp", uint8Array: TEST_IMAGE } },
    prompt: "test prompt",
    provenance: imageProvenance,
  } as never);

  vi.mocked(checkLessonImage).mockResolvedValue({
    data: { ...passedCheck.data, passed, problems: passed ? [] : ["wrong object"] },
  } as never);
}

describe("preparing media for a proposed content fix", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stores the clip of the fix's new text on the fix, ready for approval", async () => {
    const { fix, proposer } = await owedWordFix();

    storeUploads();

    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: {
        audio: new Uint8Array([1, 2, 3]),
        durationMs: 900,
        format: "mp3",
        provenance: SPEECH_PROVENANCE,
      },
      error: null,
    });

    await mediaTask({ fixId: fix.id, userId: proposer.id });

    expect(vi.mocked(generateLanguageAudio)).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ language: "en", text: "rental" }),
    );

    await expect(
      prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } }),
    ).resolves.toMatchObject({
      media: [
        {
          need: wordClip,
          result: {
            kind: "clip",
            provenance: { runId: SPEECH_PROVENANCE.runId },
            url: expect.stringContaining("blob.test"),
          },
        },
      ],
      mediaOwedAt: null,
    });
  });

  it("records a voice that failed every retry, so the fix can't be approved", async () => {
    const { fix, proposer } = await owedWordFix();

    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: null,
      error: new Error("Text-to-speech is unavailable"),
    });

    await mediaTask({ fixId: fix.id, userId: proposer.id });

    await expect(
      prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } }),
    ).resolves.toMatchObject({ media: [{ result: "failed" }], mediaOwedAt: expect.any(Date) });
  });

  it("saves a checked picture and a shared idea icon for the reviewer", async () => {
    const icon = {
      key: "map:seal",
      kind: "ideaIcon" as const,
      need: { description: "A wax seal", name: "wax seal", searchWords: ["wax"] },
    };

    const { fix, proposer } = await owedWordFix([picture, icon]);
    mockPictureCheck(true);
    vi.mocked(generateLessonIconImage).mockResolvedValue(drawnIcon as never);

    await mediaTask({ fixId: fix.id, userId: proposer.id });

    expect(checkLessonImage).toHaveBeenCalledOnce();
    expect(generateLessonIconImage).toHaveBeenCalledOnce();
    const stored = await prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } });
    const media = readContentFixMedia(stored.media);
    expect(stored.mediaOwedAt).toBeNull();

    expect(media).toMatchObject([
      { need: picture, result: { kind: "picture", url: expect.stringContaining("blob.test") } },
      { need: icon, result: { kind: "ideaIcon", url: expect.stringContaining("blob.test") } },
    ]);

    const result = media[0]?.result;

    if (!result || result === "failed" || result.kind !== "picture") {
      throw new Error("Expected a checked picture");
    }

    await expect(
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: result.mediaAssetId } }),
    ).resolves.toMatchObject({ checkOwedAt: null, url: result.url });
  });

  it("keeps the fix waiting when a picture fails its check", async () => {
    const { fix, proposer } = await owedWordFix([picture]);
    mockPictureCheck(false);

    await mediaTask({ fixId: fix.id, userId: proposer.id });

    expect(checkLessonImage).toHaveBeenCalledOnce();

    await expect(
      prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } }),
    ).resolves.toMatchObject({
      media: [{ need: picture, result: "failed" }],
      mediaOwedAt: expect.any(Date),
    });

    await expect(
      prisma.mediaAsset.count({ where: { reuseKey: { startsWith: `image:fix:${fix.id}:` } } }),
    ).resolves.toBe(0);
  });

  it("marks the example a rewritten explanation lacks, and a failed marking never holds the fix", async () => {
    const marks = {
      key: "marks",
      kind: "marks" as const,
      language: "en",
      lessonTitle: "Halves",
      screens: [
        {
          hasVisual: false,
          kind: "explanation" as const,
          text: "Halves are equal parts. Two halves of an orange make one orange.",
          title: null,
        },
      ],
    };

    const example = "Two halves of an orange make one orange.";

    vi.mocked(tagLesson).mockResolvedValueOnce({
      data: { ideas: [], screens: [{ example, icon: null, ideaIndex: null, underline: null }] },
    } as never);

    const marked = await owedWordFix([marks]);
    await mediaTask({ fixId: marked.fix.id, userId: marked.proposer.id });

    await expect(
      prisma.contentFix.findUniqueOrThrow({ where: { id: marked.fix.id } }),
    ).resolves.toMatchObject({
      media: [{ result: { kind: "marks", screens: [{ example, underline: null }] } }],
      mediaOwedAt: null,
    });

    vi.mocked(tagLesson).mockRejectedValue(new Error("The model is unavailable"));
    const failed = await owedWordFix([marks]);
    await mediaTask({ fixId: failed.fix.id, userId: failed.proposer.id });

    await expect(
      prisma.contentFix.findUniqueOrThrow({ where: { id: failed.fix.id } }),
    ).resolves.toMatchObject({
      media: [{ result: { kind: "marks", screens: [] } }],
      mediaOwedAt: null,
    });
  });
});
