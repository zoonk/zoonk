import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { onTestFinished, test } from "vitest";
import { untrackedCatalogs } from "./catalogs.mts";

test("translatable resources cannot bypass Eloqnt via another XML file, locale, source set, or module", async () => {
  const root = await mkdtemp(join(tmpdir(), "zoonk-android-catalogs-"));
  onTestFinished(() => rm(root, { force: true, recursive: true }));
  const source = '<resources><string name="title">Home</string></resources>';

  const tracked = [
    "core/resources/src/main/res/values/strings.xml",
    "core/resources/src/main/res/values-de/strings.xml",
    "core/resources/src/main/res/values/strings_today.xml",
    "core/resources/src/main/res/values-de/strings_today.xml",
  ];

  const untracked = [
    "core/resources/src/main/res/values/feature.xml",
    "core/resources/src/main/res/values-de/strings_removed.xml",
    "core/resources/src/main/res/values-ar/strings.xml",
    "app/src/debug/res/values/strings.xml",
    "app/src/main/res/values/strings.xml",
  ];

  async function writeCatalog(path: string) {
    const file = join(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, source);
  }

  await Promise.all([...tracked, ...untracked].map((path) => writeCatalog(path)));

  await writeFile(
    join(root, "core/resources/src/main/res/values/colors.xml"),
    '<resources><color name="background">#FFFFFF</color><string name="brand" translatable="false">Zoonk</string></resources>',
  );

  const found = await untrackedCatalogs(root);
  assert.deepEqual(found.toSorted(), untracked.toSorted());
});
