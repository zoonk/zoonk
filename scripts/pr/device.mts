import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { z } from "zod";
import { carryReads } from "./carry.mts";
import { REFERENCE, captionWords, unwritablePath } from "./device-section.mts";
import {
  type CaptureItem,
  fileName,
  isRecorded,
  pathWithin,
  readManifest,
  registerItems,
} from "./media.mts";
import { readCheckoutBuild, sha256File, sha256Text } from "./provenance.mts";

const run = promisify(execFile);
const MS_PER_SECOND = 1000;

/**
 * The installed app's build as the device can report it: a Debug simulator build carries its
 * stamp (`apps/apple/scripts/stamp-debug-build.sh`); an emulator's app carries no commit, only
 * when it was installed and its version.
 */
export type Installed = { commit: string; dirty: boolean } | { installedAt: Date; version: string };

export type DeviceBridge = {
  appearance: (id: string) => Promise<"dark" | "light">;
  describe: (id: string) => Promise<string | null>;
  installed: (id: string) => Promise<Installed>;
  screenshot: (id: string, file: string) => Promise<void>;
};

const APPLE_BUNDLE = "com.zoonk.dev";

const BOOTED = z.object({
  devices: z.record(z.string(), z.array(z.object({ name: z.string(), udid: z.string() }))),
});

/** What `stamp-debug-build.sh` writes into a Debug build. */
const STAMP = z.object({ commit: z.string(), dirty: z.boolean() });
/** The Debug build an emulator runs (`applicationIdSuffix = ".debug"`). */
const ANDROID_PACKAGE = "com.zoonk.debug";

/** A booted simulator, by its udid. */
const simulator: Omit<DeviceBridge, "screenshot"> = {
  appearance: async (udid) => {
    const { stdout } = await run("xcrun", ["simctl", "ui", udid, "appearance"]);
    return stdout.trim() === "dark" ? "dark" : "light";
  },
  describe: async (udid) => {
    const { stdout } = await run("xcrun", ["simctl", "list", "devices", "booted", "-j"]);
    const { devices } = BOOTED.parse(JSON.parse(stdout));

    const found = Object.entries(devices).flatMap(([runtime, list]) =>
      list
        .filter((device) => device.udid === udid)
        .map((device) => `${device.name}, ${runtime.split(".").at(-1)}`),
    );

    return found[0] ?? null;
  },
  installed: async (udid) => {
    const { stdout } = await run("xcrun", [
      "simctl",
      "get_app_container",
      udid,
      APPLE_BUNDLE,
      "app",
    ]);

    const stamp = await readFile(join(stdout.trim(), "build-stamp.json"), "utf8");
    return STAMP.parse(JSON.parse(stamp));
  },
};

/** A booted emulator, by its adb serial. */
const emulator: Omit<DeviceBridge, "screenshot"> = {
  appearance: async (serial) => {
    const { stdout } = await run("adb", ["-s", serial, "shell", "cmd", "uimode", "night"]);
    return stdout.includes("Night mode: yes") ? "dark" : "light";
  },
  describe: async (serial) => {
    const state = await run("adb", ["-s", serial, "get-state"]).then(
      ({ stdout }) => stdout.trim(),
      () => "",
    );

    if (state !== "device") {
      return null;
    }

    const [model, release] = await Promise.all(
      ["ro.product.model", "ro.build.version.release"].map(async (name) => {
        const { stdout } = await run("adb", ["-s", serial, "shell", "getprop", name]);
        return stdout.trim();
      }),
    );

    return `${model}, Android ${release}`;
  },
  installed: async (serial) => {
    const { stdout } = await run("adb", [
      "-s",
      serial,
      "shell",
      "dumpsys",
      "package",
      ANDROID_PACKAGE,
    ]);

    const updated = /lastUpdateTime=(?<at>[\d-]+) (?<time>[\d:]+)/u.exec(stdout)?.groups;
    const version = /versionName=(?<name>\S+)/u.exec(stdout)?.groups?.name ?? "unknown";

    if (!updated) {
      throw new Error(`${ANDROID_PACKAGE} isn't installed on ${serial}.`);
    }

    // `dumpsys` writes the device's local time without its zone.
    const { stdout: zone } = await run("adb", ["-s", serial, "shell", "date", "+%z"]);

    const offset = zone
      .trim()
      .replace(/^(?<sign>[+-]\d{2})(?<minutes>\d{2})$/u, "$<sign>:$<minutes>");

    return { installedAt: new Date(`${updated.at}T${updated.time}${offset}`), version };
  },
};

export function deviceBridge({
  command = "agent-device",
  platform,
}: {
  command?: string;
  platform: "android" | "apple";
}): DeviceBridge {
  const apple = platform === "apple";

  return {
    ...(apple ? simulator : emulator),
    screenshot: async (id, file) => {
      await run(command, [
        "screenshot",
        file,
        "--platform",
        apple ? "ios" : "android",
        apple ? "--udid" : "--serial",
        id,
      ]);
    },
  };
}

async function pictureHash(file: string): Promise<string> {
  try {
    const image = sharp(file);
    const { format } = await image.metadata();

    if (format !== "png") {
      throw new Error(`Expected PNG, got ${format ?? "unknown format"}.`);
    }

    await image.stats();
  } catch (error) {
    throw new Error("The device did not return a valid PNG.", { cause: error });
  }

  return sha256File(file);
}

async function git(repository: string, args: string[]) {
  const { stdout } = await run("git", args, { cwd: repository });
  return stdout.trim();
}

/**
 * Why the installed build isn't this checkout's head, or null when it is. A simulator's stamp
 * names its commit; an emulator's app is held to having been installed after the head's last
 * change to the app or `packages/`, from a clean tree.
 */
async function refusal({
  changes,
  head,
  installed,
  repository,
}: {
  changes: string | undefined;
  head: string;
  installed: Installed;
  repository: string;
}): Promise<string | null> {
  if ("commit" in installed) {
    if (installed.dirty) {
      return "The installed build was built with uncommitted changes: commit, rebuild and install it.";
    }

    return installed.commit === head
      ? null
      : `The installed build is ${installed.commit.slice(0, 10)}, not this checkout's head ${head.slice(0, 10)}: rebuild and install it.`;
  }

  if (changes) {
    return "This checkout has uncommitted changes to the app or packages/: commit, rebuild and install it.";
  }

  // The head's last change to the app, or the head itself when no commit touched it.
  const changed =
    (await git(repository, [
      "log",
      "-1",
      "--format=%ct",
      "HEAD",
      "--",
      "apps/android",
      "packages",
    ])) || (await git(repository, ["log", "-1", "--format=%ct", "HEAD"]));

  const since = new Date(Number(changed) * MS_PER_SECOND);

  return installed.installedAt >= since
    ? null
    : `The app was installed ${installed.installedAt.toISOString()}, before this checkout's last change to it (${since.toISOString()}): rebuild and install it.`;
}

/**
 * Takes an after picture from a booted simulator or emulator, which no capture can take (an
 * Android sheet over its page, where a JVM render draws the sheet's window alone). The command
 * takes the picture itself and records the installed build as the device reports it; it refuses a
 * simulator build that isn't this checkout's head and an emulator app installed before the head's
 * last change to it. Nothing measures its layout: the PR shows it under its own heading.
 */
export async function takeDevicePicture({
  bridge,
  deviceId,
  name,
  platform,
  repository,
  to,
}: {
  bridge: DeviceBridge;
  deviceId: string;
  name: string;
  platform: "android" | "apple";
  repository: string;
  to: string;
}): Promise<CaptureItem> {
  // The path as a body writes it, from the repository's root.
  const unwritable = unwritablePath(pathWithin(repository, join(to, `${fileName(name)}.png`)));

  if (unwritable) {
    throw new Error(unwritable);
  }

  const device = await bridge.describe(deviceId).catch(() => null);

  if (!device) {
    throw new Error(
      `${deviceId} isn't a booted simulator or emulator. A web page in a phone-sized browser is a web capture: take it with pnpm pr:capture.`,
    );
  }

  const [{ current: _current, ...checkout }, installed, scheme] = await Promise.all([
    readCheckoutBuild({ app: platform, repository }),
    bridge.installed(deviceId),
    bridge.appearance(deviceId),
  ]);

  const why = await refusal({
    changes: checkout.changes,
    head: checkout.commit,
    installed,
    repository,
  });

  if (why) {
    throw new Error(why);
  }

  const file = `${fileName(name)}.png`;

  // Only what the device reported: an emulator's app names no commit, so none is recorded.
  const build =
    "commit" in installed
      ? { app: platform, commit: installed.commit, id: installed.commit }
      : {
          app: platform,
          commit: "unknown",
          id: `installed ${installed.installedAt.toISOString()}, app ${installed.version}`,
        };

  const item: CaptureItem = {
    build,
    device,
    file,
    kind: "shot",
    locale: "unknown",
    name: fileName(name),
    platform,
    pointer: "coarse",
    scale: 1,
    scheme,
    sha256: "",
    shows: name,
    side: "after",
    steps: sha256Text(`${deviceId} ${name}`),
    viewport: device,
  };

  // Everything the caption will print, refused before anything is taken.
  const linked = captionWords(item).find((words) => REFERENCE.test(words));

  if (linked) {
    throw new Error(
      `The caption would print "${linked}", and GitHub links an @name, a #number, a GH-number or an issue's URL in it even escaped, notifying that person or leaving a reference on that issue: change --name, rename the device, or install a build whose version holds none.`,
    );
  }

  await mkdir(to, { recursive: true });
  const shot = await mkdtemp(join(tmpdir(), "device-"));

  try {
    const picture = join(shot, file);
    await bridge.screenshot(deviceId, picture);
    const taken = { ...item, sha256: await pictureHash(picture) };

    // Before the new picture overwrites the old one: a retake keeps the read it retakes.
    const [carried = taken] = await carryReads({
      folder: shot,
      items: [taken],
      keep: to,
      previous: ((await readManifest(to)) ?? []).filter((earlier) => isRecorded(earlier)),
      previousFolder: to,
    });

    await copyFile(join(shot, file), join(to, file));
    await registerItems(to, [carried]);
    return carried;
  } finally {
    await rm(shot, { force: true, recursive: true });
  }
}
