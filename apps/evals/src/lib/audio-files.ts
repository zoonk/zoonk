import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Generated audio lives next to the saved outputs, so a run can be scored and listened to later. */
const AUDIO_DIR = path.join(process.cwd(), "eval-results", "audio");

/** Saves a generated MP3 clip and returns its path relative to the audio folder. */
export async function saveEvalAudio({
  audio,
  modelId,
  name,
  taskId,
}: {
  audio: Uint8Array;
  modelId: string;
  name: string;
  taskId: string;
}): Promise<string> {
  const relativePath = path.join(taskId, modelId.replaceAll("/", "-"), `${name}.mp3`);
  const filePath = path.join(AUDIO_DIR, relativePath);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, audio);

  return relativePath;
}

export async function readEvalAudio(relativePath: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(path.join(AUDIO_DIR, relativePath)));
}
