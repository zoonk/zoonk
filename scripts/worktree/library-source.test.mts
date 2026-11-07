import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readLibrarySource } from "./library-source.mts";

const roots: string[] = [];

function makeCheckout(): { root: string; write: (file: string, text: string) => void } {
  const root = mkdtempSync(join(tmpdir(), "zoonk-library-source-"));
  roots.push(root);

  const write = (file: string, text: string) => {
    const path = join(root, "packages/db/src/prisma", file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };

  write("migrations/20260101000000_init/migration.sql", "CREATE TABLE lessons ();");
  write("seed/library/lesson.ts", "export const lesson = 1;");
  write("seed-library.ts", "await writeSeedLibrary();");
  write("seed.ts", "await seed();");

  return { root, write };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe(readLibrarySource, () => {
  it.each([
    ["a new migration", "migrations/20260102000000_reset_lessons/migration.sql", "UPDATE lessons;"],
    ["an edited seed file", "seed/library/lesson.ts", "export const lesson = 2;"],
    ["an edited Library entry", "seed-library.ts", "await writeSeedLibrary({});"],
  ])("changes with %s", async (_name, file, text) => {
    const { root, write } = makeCheckout();
    const before = await readLibrarySource(root);

    write(file, text);

    await expect(readLibrarySource(root)).resolves.not.toBe(before);
  });

  it("stays the same for files the Library isn't written from", async () => {
    const { root, write } = makeCheckout();
    const before = await readLibrarySource(root);

    write("seed.ts", "await seed({ learners: true });");
    write("migrations/migration_lock.toml", 'provider = "postgresql"');

    await expect(readLibrarySource(root)).resolves.toBe(before);
  });
});
