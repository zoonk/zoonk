import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, it } from "vitest";
import { checkBody } from "./body-check.mts";
import { CLEAN, checkFixture } from "./check-fixture.mts";
import { deviceSection } from "./device-section.mts";
import { type DeviceBridge, type Installed, takeDevicePicture } from "./device.mts";
import {
  type CaptureItem,
  type Finding,
  deviceLine,
  readManifest,
  writeManifest,
} from "./media.mts";
import { sha256File } from "./provenance.mts";
import { recordReads } from "./read.mts";
import { formatCheck } from "./report.mts";

/** A blank picture of `background`, as a device draws one. */
async function png(background: string) {
  return sharp({ create: { background, channels: 4, height: 8, width: 8 } })
    .png()
    .toBuffer();
}

const PICTURE = await png("#fff");

/** A booted device that draws `bytes` and reports `installed` as its app's build. */
function bridge(installed: Installed, booted = true, bytes = PICTURE): DeviceBridge {
  return {
    describe: async () => (booted ? "iPhone 17, iOS 26.1" : null),
    installed: async () => installed,
    screenshot: async (_id, file) => writeFileSync(file, bytes),
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

  const markdown = deviceSection([{ item, link: picture }]);
  const result = await checkBody({ markdown, repository, root: repository });

  return { item, result, to };
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

  it("records a retake as unread, its new read keeping the findings of the read it retakes", async () => {
    const { repository } = checkFixture();
    const installed = { commit: head(repository), dirty: false };
    const { item: first, to } = await take(repository, installed, "apple");
    const finding: Finding = { id: "a-1", state: "open", text: "the sheet hides the plan" };
    await writeManifest(to, [{ ...first, read: { ...CLEAN, findings: [finding] } }]);

    const retaken = await takeDevicePicture({
      bridge: bridge(installed, true, await png("#000")),
      deviceId: "booted-device",
      name: "sheet over plan",
      platform: "apple",
      repository,
      to,
    });

    const picture = join(to, "sheet-over-plan.png");
    assert.deepEqual(await readManifest(to), [retaken]);
    assert.equal(retaken.sha256, await sha256File(picture));

    const markdown = deviceSection([{ item: retaken, link: picture }]);
    const unread = await checkBody({ markdown, repository, root: repository });
    assert.deepEqual(unread.problems, [{ kind: "unread", picture }]);

    await recordReads({ by: "reader", entries: [], root: to });
    const read = await checkBody({ markdown, repository, root: repository });

    assert.deepEqual(read.problems, [
      { detail: "a-1: the sheet hides the plan", kind: "finding", picture },
    ]);
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
    const { changedAt, repository } = checkFixture();
    const at = (seconds: number) => new Date(changedAt.getTime() + seconds * 1000);
    const after = await take(repository, { installedAt: at(1), version: "1.0" }, "android");

    assert.deepEqual(after.result.problems, []);

    await assert.rejects(
      take(repository, { installedAt: at(-1), version: "1.0" }, "android"),
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

  it("records what an emulator reports, never the checkout's commit", async () => {
    const { changedAt, repository } = checkFixture();
    const installedAt = new Date(changedAt.getTime() + 1000);

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

  it("refuses what GitHub links even escaped: an @name, a #number, a GH-number, an issue's URL", async () => {
    const { repository } = checkFixture();

    const takeNamed = async (name: string, booted: DeviceBridge) =>
      takeDevicePicture({
        bridge: booted,
        deviceId: "booted-device",
        name,
        platform: "apple",
        repository,
        to: mkdtempSync(join(repository, "device-")),
      });

    const current = bridge({ commit: head(repository), dirty: false });

    const names = [
      "sheet for @reviewer",
      "sheet from #12",
      "sheet from gh-3",
      "sheet from example/repo/issues/4",
    ];

    const refused = await Promise.all(
      names.map(async (name) => takeNamed(name, current).then(() => "taken", String)),
    );

    assert.ok(refused.every((why) => /GitHub links/u.test(why)));

    await assert.rejects(
      takeNamed("sheet", { ...current, describe: async () => "Test phone #2, iOS 26.1" }),
      /GitHub links/u,
    );
  });

  it("refuses what GitHub links in the build the device reports, too", async () => {
    const { changedAt, repository } = checkFixture();

    const versions = await Promise.all(
      ["1.0-@octocat", "1.0-#123"].map(async (version) =>
        takeDevicePicture({
          bridge: bridge({ installedAt: new Date(changedAt.getTime() + 1000), version }),
          deviceId: "booted-device",
          name: "sheet",
          platform: "android",
          repository,
          to: mkdtempSync(join(repository, "device-")),
        }).then(() => "taken", String),
      ),
    );

    assert.ok(
      versions.every((why) => /GitHub links/u.test(why)),
      versions.join("\n"),
    );
  });
});
