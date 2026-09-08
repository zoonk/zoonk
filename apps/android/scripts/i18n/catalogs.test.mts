import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { onTestFinished, test } from "vitest";
import { untrackedCatalogs } from "./catalogs.mts";

test("translatable resources cannot bypass Eloqnt via another XML file, locale, or source set", async () => {
  const root = await mkdtemp(join(tmpdir(), "zoonk-android-catalogs-"));
  onTestFinished(() => rm(root, { force: true, recursive: true }));
  const source = '<resources><string name="title">Home</string></resources>';

  const paths = [
    "app/src/main/res/values/strings.xml",
    "app/src/main/res/values-de/strings.xml",
    "app/src/main/res/values/feature.xml",
    "app/src/main/res/values-ja/strings.xml",
    "app/src/debug/res/values/strings.xml",
  ];

  async function writeCatalog(path: string) {
    const file = join(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, source);
  }

  await Promise.all(paths.map((path) => writeCatalog(path)));

  await writeFile(
    join(root, "app/src/main/res/values/colors.xml"),
    '<resources><color name="background">#FFFFFF</color><string name="brand" translatable="false">Zoonk</string></resources>',
  );

  const untracked = await untrackedCatalogs(root);
  assert.deepEqual(untracked.toSorted(), paths.slice(2).toSorted());
});
