import "server-only";
import { transcribeMaterial } from "@zoonk/ai/tasks/material/transcribe";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getOnboardingDraftsCacheTag } from "../../cache/tags";
import { optimizeImage } from "../../images/optimize-image";
import { MAX_PAGE_EDGE, renderPdfPage } from "./render-pdf-page";
import { PAGE_BREAK, PDF_CONTENT_TYPE, sourceStructureSchema } from "./source-contract";
import { matchesSourceImageSignature } from "./source-image-signature";
import { readUploadedBlob } from "./upload-blob";

const MAX_PHOTO_PIXELS = 64_000_000;

export async function findOwedUpload(sourceId: string) {
  const source = await prisma.source.findFirst({
    select: { blobUrl: true, mimeType: true, ownerId: true, structure: true, updatedAt: true },
    where: { id: sourceId, kind: "upload", readState: "owed", visibility: "private" },
  });

  if (!source) {
    return null;
  }

  const structure = sourceStructureSchema.safeParse(source.structure).data;

  return {
    blobUrl: source.blobUrl,
    indices: structure?.visualPages ?? [],
    mimeType: source.mimeType,
    ownerId: source.ownerId,
    updatedAt: source.updatedAt,
  };
}

export type UploadReading = NonNullable<Awaited<ReturnType<typeof findOwedUpload>>>;

async function renderPhotoPage(photo: Parameters<typeof matchesSourceImageSignature>[0]) {
  if (!matchesSourceImageSignature(photo)) {
    throw new Error("The uploaded photo does not match its file type");
  }

  const { data, error } = await optimizeImage({
    format: "jpeg",
    image: photo.bytes,
    limitInputPixels: MAX_PHOTO_PIXELS,
    maxEdge: MAX_PAGE_EDGE,
  });

  if (error) {
    throw error;
  }

  return { data, mediaType: "image/jpeg" };
}

export async function readUploadPage({
  index,
  upload,
}: {
  index: number;
  upload: UploadReading;
}): Promise<string | null> {
  const blob = upload.blobUrl ? await readUploadedBlob(upload.blobUrl) : null;

  if (!blob || !upload.ownerId || blob.contentType !== upload.mimeType) {
    throw new Error("The uploaded material could not be opened");
  }

  const image =
    blob.contentType === PDF_CONTENT_TYPE
      ? await renderPdfPage({ bytes: blob.bytes, index })
      : await renderPhotoPage(blob);

  if (!image) {
    return null;
  }

  const { data } = await transcribeMaterial({
    analytics: { contentScope: "personal", distinctId: upload.ownerId },
    image,
  });

  return data.text.replaceAll("\u0000", "").replaceAll(PAGE_BREAK, "\n");
}

export type UploadPage = { index: number; text: string };

export async function saveUploadReading({
  failed,
  pages,
  sourceId,
  updatedAt,
}: {
  failed: boolean;
  pages: UploadPage[];
  sourceId: string;
  updatedAt?: Date;
}): Promise<void> {
  const where = { id: sourceId, readState: "owed" as const, updatedAt };

  const source = await prisma.source.findFirst({
    select: { extractedText: true, ownerId: true },
    where,
  });

  if (!source) {
    return;
  }

  const byIndex = new Map(pages.map(({ index, text }) => [index, text]));
  const text = (source.extractedText ?? "").split(PAGE_BREAK);

  const { count } = await prisma.source.updateMany({
    data: {
      extractedText: text.map((page, index) => byIndex.get(index) ?? page).join(PAGE_BREAK),
      readState: failed ? "failed" : "read",
    },
    where,
  });

  if (count > 0 && source.ownerId) {
    revalidateCacheTags([getOnboardingDraftsCacheTag(source.ownerId)]);
  }
}
