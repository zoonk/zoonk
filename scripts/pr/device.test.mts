import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import { CLEAN, checkFixture, kinds } from "./check-fixture.mts";
import { checkPictures } from "./check.mts";
import { type DeviceBridge, type Installed, takeDevicePicture } from "./device.mts";
import { type CaptureItem, deviceLine, readManifest, writeManifest } from "./media.mts";
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

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The command records one capture.
  const item = items[0] as CaptureItem;
  const picture = join(to, "sheet-over-plan.png");

  const result = await checkPictures({
    manifests: [to],
    onDevice: [{ caption: deviceLine(item), path: picture }],
    pictures: [],
    repository,
  });

  return { item, result };
}

describe("pnpm pr:media device: a picture the tool takes from a booted device", () => {
  it("records a simulator's picture of the head's clean build, its layout left to its read", async () => {
    const { repository } = checkFixture();
    const commit = head(repository);
    const { item, result } = await take(repository, { commit, dirty: false }, "apple");

    assert.deepEqual(result.problems, []);
    assert.equal(deviceLine(item), `iPhone 17, iOS 26.1; build ${commit.slice(0, 10)}`);

    assert.match(
      formatCheck(result, repository),
      /^On a device, layout not measured \(1\):\n {2}.*sheet-over-plan\.png: iPhone 17, iOS 26\.1; build \w{10}$/mu,
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

    assert.deepEqual(fresh.result.problems, []);

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

  it("records what an emulator reports, never the checkout's commit (RV74 androidOlderInstalledNow)", async () => {
    const { repository } = checkFixture();
    const installedAt = new Date();

    const { item, result } = await take(
      repository,
      { installedAt, version: "old-branch-1.0" },
      "android",
    );

    assert.notEqual(item.build.commit, head(repository));

    assert.equal(
      deviceLine(item),
      `iPhone 17, iOS 26.1; build not verified, installed ${installedAt.toISOString()}, app old-branch-1.0`,
    );

    assert.deepEqual(result.problems, []);
    assert.match(formatCheck(result, repository), /build not verified, installed /u);
  });
});

/** RV74's case: a web picture given a device record by hand, with the head's build and a read. */
function handWritten() {
  const fixture = checkFixture();
  const forged = fixture.shot({ device: "iPhone 17, iOS 26.1", file: "grid-overflow.png" });
  return { ...fixture, folder: fixture.capture([forged]).folder, forged };
}

describe("a device picture in the PR body", () => {
  it("fails anywhere but under its heading (RV74 handWrittenNoDevice)", async () => {
    const { folder, repository } = handWritten();

    const result = await checkPictures({
      manifests: [folder],
      pictures: [join(folder, "grid-overflow.png")],
      repository,
    });

    assert.deepEqual(kinds(result), ["device-elsewhere"]);
  });

  it("under its heading, is shown apart as unmeasured, its caption the line the check verified", async () => {
    const { folder, forged, repository } = handWritten();
    const path = join(folder, "grid-overflow.png");

    const check = async (caption: string) =>
      checkPictures({
        manifests: [folder],
        onDevice: [{ caption, path }],
        pictures: [],
        repository,
      });

    const shown = await check(deviceLine(forged));

    assert.deepEqual(shown.problems, []);

    assert.match(
      formatCheck(shown, repository),
      /^On a device, layout not measured \(1\):\n.*grid-overflow\.png: iPhone 17, iOS 26\.1; build \w{10}\n(?:.*\n)*PASS: 1 picture on a device, layout not measured, listed above$/u,
    );

    assert.deepEqual(kinds(await check("iPhone 17, iOS 26.1; build checked")), ["caption"]);
  });

  it("fails under its heading without a device record", async () => {
    const { capture, repository, shot } = checkFixture();
    const { folder } = capture([shot({ file: "today.png" })]);

    const result = await checkPictures({
      manifests: [folder],
      onDevice: [{ caption: "iPhone 17", path: join(folder, "today.png") }],
      pictures: [],
      repository,
    });

    assert.deepEqual(kinds(result), ["not-device"]);
  });
});
