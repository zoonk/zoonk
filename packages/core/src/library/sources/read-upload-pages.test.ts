import { randomBytes } from "node:crypto";
import { transcribeMaterial } from "@zoonk/ai/tasks/material/transcribe";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { readUploadPage } from "./read-upload-pages";
import { readUploadedBlob } from "./upload-blob";

// Exercise the image pipeline without reaching blob storage or spending on a model call.
vi.mock("./upload-blob", () => ({ readUploadedBlob: vi.fn() }));

vi.mock("@zoonk/ai/tasks/material/transcribe", () => ({
  transcribeMaterial: vi.fn().mockResolvedValue({ data: { text: "Notes" } }),
}));

function readStoredPhoto({ bytes, contentType }: { bytes: Uint8Array; contentType: string }) {
  const url = "https://store.private.blob.vercel-storage.com/sources/learner/notes";
  vi.mocked(readUploadedBlob).mockResolvedValueOnce({ bytes, contentType, url });

  return readUploadPage({
    index: 0,
    upload: {
      blobUrl: url,
      indices: [0],
      mimeType: contentType,
      ownerId: "learner",
      updatedAt: new Date(),
    },
  });
}

async function readPhoto(input: Parameters<typeof readStoredPhoto>[0]) {
  await readStoredPhoto(input);
  const image = vi.mocked(transcribeMaterial).mock.lastCall?.[0].image;

  if (!image) {
    throw new Error("No image reached transcription");
  }

  return {
    bytes: typeof image.data === "string" ? Buffer.from(image.data, "base64") : image.data,
    mediaType: image.mediaType,
  };
}

describe(readUploadPage, () => {
  it("refuses to resize a photo whose bytes no longer match its saved type", async () => {
    const bytes = await sharp({ create: { background: "white", channels: 3, height: 8, width: 8 } })
      .webp()
      .toBuffer();

    const precedingCalls = vi.mocked(transcribeMaterial).mock.calls.length;
    await expect(readStoredPhoto({ bytes, contentType: "image/png" })).rejects.toThrow();
    expect(transcribeMaterial).toHaveBeenCalledTimes(precedingCalls);
  });

  it("sends a large photo as a JPEG within the model's byte limit and the PDF page edge", async () => {
    const raw = { channels: 3, height: 2000, width: 3000 } as const;

    const bytes = await sharp(randomBytes(raw.width * raw.height * raw.channels), { raw })
      .png()
      .toBuffer();

    const maxImageBytes = 5_000_000;
    expect(bytes.byteLength).toBeGreaterThan(maxImageBytes);

    const image = await readPhoto({ bytes, contentType: "image/png" });
    const metadata = await sharp(image.bytes).metadata();

    expect(image.bytes.byteLength).toBeLessThan(maxImageBytes);
    expect(image.mediaType).toBe("image/jpeg");
    expect(metadata).toMatchObject({ format: "jpeg", height: 1200, width: 1800 });
  });

  it("turns a small sideways photo upright without enlarging it", async () => {
    const bytes = await sharp({
      create: { background: "white", channels: 3, height: 80, width: 120 },
    })
      .extend({ background: "black", bottom: 0, left: 120, right: 0, top: 0 })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const image = await readPhoto({ bytes, contentType: "image/jpeg" });
    const { data, info } = await sharp(image.bytes).raw().toBuffer({ resolveWithObject: true });

    expect(info).toMatchObject({ height: 240, width: 80 });
    expect(data[0]).toBe(0);
    expect(data.at(-1)).toBe(255);
  });
});
