import { createHash } from "node:crypto";
import { glob, readFile } from "node:fs/promises";
import { join } from "node:path";

/** The seed's Library is written from the checkout's migrations and seed, so this changes with them. */
export async function readLibrarySource(worktree: string): Promise<string> {
  const directory = join(worktree, "packages/db/src/prisma");

  const found = await Array.fromAsync(
    glob(["migrations/**/*.sql", "seed/**/*.ts", "seed-library.ts"], { cwd: directory }),
  );

  const files = found.toSorted();
  const contents = await Promise.all(files.map((file) => readFile(join(directory, file))));
  const hash = createHash("sha256");

  for (const [index, file] of files.entries()) {
    hash.update(file).update(contents[index] ?? "");
  }

  return hash.digest("hex");
}
