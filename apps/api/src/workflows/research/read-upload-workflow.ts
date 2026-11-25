import {
  type UploadPage,
  type UploadReading,
  findOwedUpload,
  readUploadPage,
  saveUploadReading,
} from "@zoonk/core/library/sources/read-upload-pages";
import { FatalError } from "workflow";
import { startOnce } from "../_shared/run-token";

const CONCURRENT_PAGES = 4;

async function findOwedUploadStep(sourceId: string) {
  "use step";

  return findOwedUpload(sourceId);
}

async function readUploadPageStep(input: {
  index: number;
  upload: UploadReading;
}): Promise<UploadPage> {
  "use step";

  const text = await readUploadPage(input);

  if (text === null) {
    throw new FatalError("PDF page rendering exceeded its time limit");
  }

  return { index: input.index, text };
}

async function saveUploadReadingStep(input: Parameters<typeof saveUploadReading>[0]) {
  "use step";

  await saveUploadReading(input);
}

async function readPages(upload: UploadReading) {
  const waves = Array.from(
    { length: Math.ceil(upload.indices.length / CONCURRENT_PAGES) },
    (_, wave) => upload.indices.slice(wave * CONCURRENT_PAGES, (wave + 1) * CONCURRENT_PAGES),
  );

  return waves.reduce<Promise<PromiseSettledResult<UploadPage>[]>>(async (pending, wave) => {
    const completed = await pending;

    const next = await Promise.allSettled(
      wave.map((index) => readUploadPageStep({ index, upload })),
    );

    return [...completed, ...next];
  }, Promise.resolve([]));
}

export async function readUploadWorkflow(sourceId: string): Promise<void> {
  "use workflow";

  const upload = await findOwedUploadStep(sourceId).catch(() => null);

  if (!upload) {
    await saveUploadReadingStep({ failed: true, pages: [], sourceId });
    return;
  }

  const results = await readPages(upload);

  await saveUploadReadingStep({
    failed: results.length === 0 || results.some((result) => result.status === "rejected"),
    pages: results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
    sourceId,
    updatedAt: upload.updatedAt,
  });
}

export function startUploadReading(sourceId: string) {
  return startOnce(readUploadWorkflow, [sourceId], `source-reading:${sourceId}`);
}
