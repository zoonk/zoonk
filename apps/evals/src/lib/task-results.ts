import fs from "node:fs/promises";
import path from "node:path";

const RESULTS_DIR = path.join(process.cwd(), "eval-results", "results");

export async function countScoredModels(taskId: string): Promise<number> {
  const files = await fs.readdir(path.join(RESULTS_DIR, taskId)).catch(() => []);

  return files.filter((file) => file.endsWith(".json")).length;
}
