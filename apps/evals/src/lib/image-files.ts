import { AsyncLocalStorage } from "node:async_hooks";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { optimizeImage } from "@zoonk/core/images/optimize";
import { hash } from "./comparisons/identity";
import { writeBytes } from "./comparisons/storage";

const IMAGES_DIR = path.join(process.cwd(), "eval-results", "images");

const DATASET_IMAGES_DIR = path.join(process.cwd(), "datasets", "images");

const capturedImages = new AsyncLocalStorage<Map<string, Buffer>>();

export function captureEvalImages<T>(run: () => Promise<T>) {
  return capturedImages.run(new Map(), run);
}

export function evalImageDigest(relativePath: string) {
  return /-(?<digest>[a-f0-9]{64})\.webp$/u.exec(path.basename(relativePath))?.groups?.digest;
}

function evalImageFile(relativePath: string) {
  const file = path.resolve(IMAGES_DIR, relativePath);

  if (!file.startsWith(IMAGES_DIR + path.sep) || path.extname(file) !== ".webp") {
    throw new Error("Invalid saved eval image path.");
  }

  return file;
}

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
  const { data: optimized, error } = await optimizeImage({ image: Buffer.from(image) });

  if (error) {
    throw error;
  }

  const relativePath = path.join(
    taskId,
    modelId.replaceAll("/", "-"),
    `${runId}-${hash(optimized)}.webp`,
  );

  const file = evalImageFile(relativePath);
  const captured = capturedImages.getStore();

  if (captured) {
    captured.set(relativePath, optimized);
  } else {
    await writeBytes(file, optimized);
  }

  return relativePath;
}

export async function readEvalImage(relativePath: string): Promise<Uint8Array> {
  const captured = capturedImages.getStore();

  if (captured) {
    const bytes = captured.get(relativePath);

    if (!bytes) {
      throw new Error("Image was not produced by this generation.");
    }

    return bytes;
  }

  return new Uint8Array(await readFile(evalImageFile(relativePath)));
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
