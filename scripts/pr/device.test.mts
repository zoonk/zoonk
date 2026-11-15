import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import { CLEAN, checkFixture } from "./check-fixture.mts";
import { checkPictures } from "./check.mts";
import { type DeviceBridge, type Installed, takeDevicePicture } from "./device.mts";
import { readManifest, writeManifest } from "./media.mts";
import { formatCheck } from "./report.mts";

/** A booted device that draws `bytes` and reports `installed` as its app's build. */
function bridge(installed: Installed, booted = true): DeviceBridge {
  return {
    describe: async () => (booted ? "iPhone 17, iOS 26.1" : null),
    installed: async () => installed,
    screenshot: async (_id, file) => writeFileSync(file, "the simulator's picture"),
  };
}

function head(repository: string) {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim();
}

async function take(repository: string, installed: Installed, platform: "android" | "apple") {
  const to = mkdtempSync(join(repository, "device-"));

  await takeDevicePicture({
    bridge: bridge(installed),
    deviceId: "booted-device",
    name: "sheet over plan",
    platform,
    repository,
    to,
  });

  const items = (await readManifest(to)) ?? [];

  await writeManifest(
    to,
    items.map((item) => ({ ...item, read: CLEAN })),
  );

  return checkPictures({
    manifests: [to],
    pictures: [join(to, "sheet-over-plan.png")],
    repository,
  });
}

describe("pnpm pr:media device: a picture the tool takes from a booted device", () => {
  it("records a simulator's picture of the head's clean build, its layout left to its read", async () => {
    const { repository } = checkFixture();
    const result = await take(repository, { commit: head(repository), dirty: false }, "apple");

    assert.deepEqual(result.problems, []);

    assert.match(
      formatCheck(result, repository),
      /^PASS: .*; 1 device picture: layout not measured, its read checks it$/mu,
    );
  });

  it("refuses a simulator whose installed build isn't the head's, or was built from changes", async () => {
    const { older, repository } = checkFixture();

    await assert.rejects(
      take(repository, { commit: older, dirty: false }, "apple"),
      /installed build is .* not this checkout's head/u,
    );

    await assert.rejects(
      take(repository, { commit: head(repository), dirty: true }, "apple"),
      /built with uncommitted changes/u,
    );
  });

  it("holds an emulator's app to being installed after the head's last change to it", async () => {
    const { repository } = checkFixture();
    const fresh = await take(repository, { installedAt: new Date(), version: "1.0" }, "android");

    assert.deepEqual(fresh.problems, []);

    await assert.rejects(
      take(repository, { installedAt: new Date("2020-01-01"), version: "1.0" }, "android"),
      /installed .* before this checkout's last change/u,
    );
  });

  it("refuses a device that isn't booted", async () => {
    const { repository } = checkFixture();

    await assert.rejects(
      takeDevicePicture({
        bridge: bridge({ commit: head(repository), dirty: false }, false),
        deviceId: "nowhere",
        name: "sheet",
        platform: "apple",
        repository,
        to: mkdtempSync(join(repository, "device-")),
      }),
      /isn't a booted simulator or emulator/u,
    );
  });
});
