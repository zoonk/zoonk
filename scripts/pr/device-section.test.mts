import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assert as assertProperty, asyncProperty, string } from "fast-check";
import { describe, it } from "vitest";
import { checkBody } from "./body-check.mts";
import { CLEAN, checkFixture, kinds } from "./check-fixture.mts";
import { deviceSection, readDeviceShots, unwritablePath } from "./device-section.mts";
import { type DeviceBridge, takeDevicePicture } from "./device.mts";
import { type CaptureItem, readManifest, writeManifest } from "./media.mts";
import { sha256File } from "./provenance.mts";
import { formatCheck } from "./report.mts";

const LINE = "Pixel 9, Android 16; build not verified, installed 2026-11-15T10:00:00.000Z, app 1.0";

/** The same line as the section writes it: its punctuation escaped, so it stays words. */
const WRITTEN_LINE = String.raw`Pixel 9\, Android 16\; build not verified\, installed 2026\-11\-15T10\:00\:00\.000Z\, app 1\.0`;
const HEADING = "## On a device (layout not measured)";

const emulator: DeviceBridge = {
  describe: async () => "Pixel 9, Android 16",
  installed: async () => ({ installedAt: new Date("2026-11-15T10:00:00.000Z"), version: "1.0" }),
  screenshot: async (_id, file) => writeFileSync(file, "the emulator's picture"),
};

/** An emulator's picture with its read, and a measured web picture, in one fixture repository. */
async function fixture() {
  const { capture, repository, shot } = checkFixture();
  const measured = capture([shot({ file: "today.png" })]);
  const to = mkdtempSync(join(repository, "device-"));

  await takeDevicePicture({
    bridge: emulator,
    deviceId: "emulator-5554",
    name: "sheet over plan",
    platform: "android",
    repository,
    to,
  });

  const items = (await readManifest(to)) ?? [];

  await writeManifest(
    to,
    items.map((item) => ({ ...item, read: CLEAN })),
  );

  const device = join(to, "sheet-over-plan.png");
  const today = join(measured.folder, "today.png");
  const check = async (markdown: string) => checkBody({ markdown, repository, root: repository });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The command records one capture.
  const section = deviceSection([{ item: items[0] as CaptureItem, link: device }]);

  return { check, device, repository, section, today };
}

/**
 * Bodies that show a device picture anywhere but in the section the tool writes, from RV77 and
 * RV78, each written as its reviewer wrote it.
 */
function escapes(device: string): Record<string, string> {
  return {
    bold: `${HEADING}\n\n**![](${device})**\nMeasured on the current build.`,
    commentHeading: `<!--\n${HEADING}\n-->\n![](${device})\n${LINE}`,
    contradiction: `${HEADING}\n![](${device})\n${LINE}. Measured on the current build.`,
    detailsHeading: `<details>\n<summary>Measured current build</summary>\n\n${HEADING}\n\n</details>\n\n![](${device})\n${LINE}`,
    fencedHeading: `\`\`\`md\n${HEADING}\n\`\`\`\n![](${device})\n${LINE}`,
    hiddenCaption: `${HEADING}\n![](${device})\n<!-- ${LINE} --> Current build d41415e8c4`,
    htmlEnd: `${HEADING}\n\n<h2>Measured current build</h2>\n\n![](${device})\n${LINE}`,
    htmlHiddenCaption: `${HEADING}\n![](${device})\n<del>${LINE}</del> Measured on the current build.`,
    linked: `${HEADING}\n\n[![](${device})](https://example.com)\nMeasured on the current build.`,
    repeatCaption: `${HEADING}\n![](${device})\n${LINE}\n\n![](${device})\nMeasured from current build d41415e8c4`,
    setext: `${HEADING}\n![](${device})\n${LINE}\n\nMeasured current build\n----------------------\n![](${device})\n${LINE}`,
    strikeCaption: `${HEADING}\n![](${device})\n~~${LINE}~~ Measured on the current build.`,
  };
}

describe("a device picture shown anywhere but in the section the tool writes (RV77, RV78)", () => {
  it("fails, for every way a reviewer wrote one, for that one reason", async () => {
    const { check, device } = await fixture();

    const found = await Promise.all(
      Object.entries(escapes(device)).map(async ([name, body]) => ({
        failed: kinds(await check(body)).join(", "),
        name,
      })),
    );

    assert.deepEqual(
      found.filter(({ failed }) => failed !== "device-section"),
      [],
    );
  });

  it("is still checked when it's nested in a link with no capture at all (lostMissing)", async () => {
    const { check } = await fixture();

    const result = await check(
      `${HEADING}\n\n[![](missing.png)](https://example.com)\nMeasured on the current build.`,
    );

    assert.equal(result.checked, 1);
    assert.deepEqual(kinds(result), ["missing"]);
  });
});

describe("the section pnpm pr:media device-section prints", () => {
  it("is the heading, then three pictures to a table: what each shows, the picture, what was verified", () => {
    const { shot } = checkFixture();

    const shots = ["1", "2", "3", "4"].map((index) => ({
      item: shot({
        build: {
          app: "android",
          commit: "unknown",
          id: "installed 2026-11-15T10:00:00.000Z, app 1.0",
        },
        device: "Pixel 9, Android 16",
        file: `shot-${index}.png`,
        shows: `Shot ${index}`,
      }),
      link: `device/shot-${index}.png`,
    }));

    assert.equal(
      deviceSection(shots),
      [
        HEADING,
        "",
        "| Shot 1 | Shot 2 | Shot 3 |",
        "| --- | --- | --- |",
        "| ![Shot 1](device/shot-1.png) | ![Shot 2](device/shot-2.png) | ![Shot 3](device/shot-3.png) |",
        `| ${WRITTEN_LINE} | ${WRITTEN_LINE} | ${WRITTEN_LINE} |`,
        "",
        "| Shot 4 |",
        "| --- |",
        "| ![Shot 4](device/shot-4.png) |",
        `| ${WRITTEN_LINE} |`,
      ].join("\n"),
    );
  });

  it("passes as printed, between blank lines, measured pictures elsewhere in the body", async () => {
    const { check, section, today } = await fixture();
    const result = await check(`## Before and after\n\n![Today](${today})\n\n${section}\n`);

    assert.deepEqual(result.problems, []);
    assert.equal(result.checked, 2);
  });

  it("fails with anything joined to it, twice in the body, or its picture shown again elsewhere", async () => {
    const { check, device, section } = await fixture();

    const bodies = [
      `${section}\nMeasured on the current build.`,
      `Notes\n${section}`,
      `${section}\n\n${section}`,
      `${section}\n\n![](${device})`,
    ];

    const results = await Promise.all(bodies.map(async (body) => kinds(await check(body))));

    assert.deepEqual(
      results,
      bodies.map(() => ["device-section"]),
    );
  });

  it("prints itself when it fails, as it is, to paste", async () => {
    const { check, device, repository, section } = await fixture();
    const printed = formatCheck(await check(`${HEADING}\n\n![](${device})`), repository);

    assert.ok(printed.includes(`\n${section}\n`));
  });
});

describe("the pictures device-section names (RV79)", () => {
  it("prints a picture named twice once, which then passes its own check (RV79 P2)", async () => {
    const { check, device } = await fixture();
    const section = deviceSection(await readDeviceShots([device, device]));

    const result = await check(`Intro\n\n${section}\n`);

    assert.deepEqual(result.problems, []);
  });

  it("refuses a path that holds anything but letters, digits, /, ., - and _ (RV79 P2)", async () => {
    const { repository } = checkFixture();

    await assert.rejects(
      takeDevicePicture({
        bridge: emulator,
        deviceId: "emulator-5554",
        name: "sheet",
        platform: "android",
        repository,
        to: join(repository, "device with spaces"),
      }),
      /a space.*another folder/u,
    );

    await assert.rejects(readDeviceShots(["device/sheet(1).png"]), /"\(".*another folder/u);

    const refused = await Promise.all(
      [String.raw`a\b`, 'a"b', "a%20b", "a#b", "a&b", "a[b]", "a'b"].map(async (path) =>
        readDeviceShots([`device/${path}/sheet.png`]).then(() => "read", String),
      ),
    );

    assert.ok(refused.every((why) => /another folder/u.test(why)));
  });

  it("for any path, either refuses it or prints a section that passes the check", async () => {
    const { repository, shot } = checkFixture();

    const take = async (folder: string) => {
      const root = mkdtempSync(join(repository, "paths-"));
      const to = join(root, folder);
      const link = join(to, "shot.png");

      if (unwritablePath(link)) {
        await assert.rejects(readDeviceShots([link]), /pick another folder/u);
        return;
      }

      mkdirSync(to, { recursive: true });
      writeFileSync(link, folder);

      const item = shot({
        build: {
          app: "android",
          commit: "unknown",
          id: "installed 2026-11-15T10:00:00.000Z, app 1.0",
        },
        device: "Pixel 9, Android 16",
        file: "shot.png",
        read: CLEAN,
        sha256: await sha256File(link),
        shows: "Shot",
      });

      await writeManifest(to, [item]);

      const section = deviceSection(await readDeviceShots([link, link]));
      const markdown = `## Before and after\n\nSome words.\n\n${section}\n\n## Next\n\nMore words.`;
      const result = await checkBody({ markdown, repository, root: repository });

      assert.deepEqual(result.problems, []);
    };

    // Any text, where a folder can't climb out of the test's own (`..`).
    const folder = string({ maxLength: 12, unit: "binary" }).filter(
      (text) => !text.split("/").includes("..") && !text.includes("\0"),
    );

    await assertProperty(asyncProperty(folder, take), { numRuns: 60 });

    for (const plain of ["shots", "día/über", "日本/写真", "a.b-c_d"]) {
      // oxlint-disable-next-line no-await-in-loop -- Each writes its own folder; order doesn't matter.
      await take(plain);
    }
  });
});
