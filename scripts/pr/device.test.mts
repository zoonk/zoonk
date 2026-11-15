import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import { CLEAN, checkFixture, kinds } from "./check-fixture.mts";
import { checkPictures } from "./check.mts";
import { registerDevicePictures } from "./device.mts";
import { readManifest, writeManifest } from "./media.mts";
import { formatCheck } from "./report.mts";

async function register(repository: string, read = false) {
  const to = mkdtempSync(join(repository, "device-"));
  const picture = join(to, "sheet-over-plan.png");
  writeFileSync(picture, "an emulator's picture");

  await registerDevicePictures({
    device: "Pixel 9 emulator, API 36",
    files: [picture],
    platform: "android",
    repository,
    to,
  });

  if (read) {
    const items = (await readManifest(to)) ?? [];

    await writeManifest(
      to,
      items.map((item) => ({ ...item, read: CLEAN })),
    );
  }

  return async () => checkPictures({ manifests: [to], pictures: [picture], repository });
}

describe("pr:media device, an emulator's or simulator's picture", () => {
  it("is captured and current once read, its layout left to the read and said so", async () => {
    const { repository } = checkFixture();
    const unread = await (await register(repository))();
    const read = await (await register(repository, true))();

    assert.deepEqual(kinds(unread), ["unread"]);
    assert.deepEqual(read.problems, []);

    assert.match(
      formatCheck(read, repository),
      /^PASS: .*; 1 device picture: layout not measured, its read checks it$/mu,
    );
  });

  it("fails from a tree with uncommitted changes to the app, and once a later commit changes it", async () => {
    const { repository } = checkFixture();
    mkdirSync(join(repository, "apps/android"), { recursive: true });
    writeFileSync(join(repository, "apps/android/Sheet.kt"), "draft");
    const dirty = await (await register(repository, true))();

    const git = (...args: string[]) => execFileSync("git", args, { cwd: repository });
    git("add", "apps/android");
    git("commit", "-qm", "the sheet");
    const committed = await register(repository, true);
    const current = await committed();
    writeFileSync(join(repository, "apps/android/Sheet.kt"), "changed");
    git("commit", "-qam", "the sheet again");

    assert.deepEqual(kinds(dirty), ["uncommitted"]);
    assert.deepEqual(current.problems, []);
    assert.deepEqual(kinds(await committed()), ["stale"]);
  });
});
