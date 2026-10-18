import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { optimizeImage } from "@zoonk/core/images/optimize";

/** Generated images live next to the saved outputs, so a run can be judged and reviewed later. */
const IMAGES_DIR = path.join(process.cwd(), "eval-results", "images");

/** Labeled images for classifier evals, kept with the other datasets. */
const DATASET_IMAGES_DIR = path.join(process.cwd(), "datasets", "images");

/**
 * Saves a generated image, compressed like stored lesson images so saved runs
 * stay small, and returns its path relative to the images folder.
 */
export async function saveEvalImage({
  image,
  modelId,
  name,
  taskId,
}: {
  image: Uint8Array;
  modelId: string;
  name: string;
  taskId: string;
}): Promise<string> {
  const relativePath = path.join(taskId, modelId.replaceAll("/", "-"), `${name}.webp`);
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
  return new Uint8Array(await readFile(path.join(IMAGES_DIR, relativePath)));
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
