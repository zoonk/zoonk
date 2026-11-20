import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { optimizeImage } from "@zoonk/core/images/optimize";

const IMAGES_DIR = path.join(process.cwd(), "eval-results", "images");

const DATASET_IMAGES_DIR = path.join(process.cwd(), "datasets", "images");

export async function saveEvalImage({
  image,
  modelId,
  runId,
  taskId,
}: {
  image: Uint8Array;
  modelId: string;
  runId: string;
  taskId: string;
}): Promise<string> {
  const relativePath = path.join(taskId, modelId.replaceAll("/", "-"), `${runId}.webp`);
  const filePath = path.join(IMAGES_DIR, relativePath);

  const { data: optimized, error } = await optimizeImage({ image: Buffer.from(image) });

  if (error) {
    throw error;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, optimized);

  return relativePath;
}

export async function readEvalImage(relativePath: string): Promise<Uint8Array> {
  const file = path.resolve(IMAGES_DIR, relativePath);

  if (!file.startsWith(IMAGES_DIR + path.sep) || path.extname(file) !== ".webp") {
    throw new Error("Invalid saved eval image path.");
  }

  return new Uint8Array(await readFile(file));
}

export async function readDatasetImage({
  fileName,
  taskId,
}: {
  fileName: string;
  taskId: string;
}): Promise<Uint8Array> {
  return new Uint8Array(await readFile(path.join(DATASET_IMAGES_DIR, taskId, fileName)));
}
