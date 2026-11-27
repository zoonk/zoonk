// The worktree sweep imports this file before a new worktree has dependencies, so it imports only from Node.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";

/** Long enough for any pause in someone's work; an emulator left this long belongs to a task that ended. */
export const IDLE_EMULATOR_MS = 2 * 60 * 60 * 1000;

const SECOND_MS = 1000;
const MINUTE_S = 60;
const HOUR_S = 60 * MINUTE_S;
const DAY_S = 24 * HOUR_S;

const COMMAND_TIMEOUT_MS = 10_000;

export function getAndroidSdkDirectory(): string {
  const androidHome = process.env.ANDROID_HOME?.trim();

  if (androidHome) {
    return path.resolve(androidHome);
  }

  const androidSdkRoot = process.env.ANDROID_SDK_ROOT?.trim();

  if (androidSdkRoot) {
    return path.resolve(androidSdkRoot);
  }

  if (platform() === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA?.trim() || path.join(homedir(), "AppData", "Local");

    return path.join(localAppData, "Android", "Sdk");
  }

  return platform() === "darwin"
    ? path.join(homedir(), "Library", "Android", "sdk")
    : path.join(homedir(), "Android", "Sdk");
}

export function parseConnectedEmulator(line: string): { serial: string }[] {
  const [serial] = line.trim().split(/\s+/u);
  return serial?.startsWith("emulator-") ? [{ serial }] : [];
}

/**
 * How long ago someone last tapped the emulator or brought an app to the front, from
 * `dumpsys power` and `dumpsys activity recents`, or nothing while it's still booting.
 */
export function getGuestIdleMs(dumpsys: string): number | undefined {
  const touched = dumpsys.matchAll(/mLastInteractivePowerHintTime=\d+ \((?<ms>\d+) ms ago\)/gu);
  const opened = dumpsys.matchAll(/lastActiveTime=\d+ \(inactive for (?<seconds>\d+)s\)/gu);

  const idle = [
    ...[...touched].map((match) => Number(match.groups?.ms)),
    ...[...opened].map((match) => Number(match.groups?.seconds) * SECOND_MS),
  ];

  return idle.length > 0 ? Math.min(...idle) : undefined;
}

/** Reads `ps -o etime`, which is `[[days-]hours:]minutes:seconds`. */
export function parseElapsedMs(elapsed: string): number | undefined {
  const groups = /^(?:(?:(?<days>\d+)-)?(?<hours>\d+):)?(?<minutes>\d+):(?<seconds>\d+)$/u.exec(
    elapsed.trim(),
  )?.groups;

  if (!groups) {
    return undefined;
  }

  const { days = "0", hours = "0", minutes = "0", seconds = "0" } = groups;

  return (
    (Number(days) * DAY_S + Number(hours) * HOUR_S + Number(minutes) * MINUTE_S + Number(seconds)) *
    SECOND_MS
  );
}

function read(command: string, args: string[]): string {
  return spawnSync(command, args, { encoding: "utf8", timeout: COMMAND_TIMEOUT_MS }).stdout ?? "";
}

/**
 * An emulator restored from a snapshot reports the activity saved with it, so a minute-old boot
 * can look idle for hours; time since its process started bounds that.
 */
function getIdleMs({ adb, serial }: { adb: string; serial: string }): number | undefined {
  const discovery = read(adb, ["-s", serial, "emu", "avd", "discoverypath"]);
  const pid = /pid_(?<pid>\d+)\.ini/u.exec(discovery)?.groups?.pid;
  const running = pid ? parseElapsedMs(read("ps", ["-o", "etime=", "-p", pid])) : undefined;

  const guest = getGuestIdleMs(
    read(adb, ["-s", serial, "shell", "dumpsys power; dumpsys activity recents"]),
  );

  return running === undefined || guest === undefined ? undefined : Math.min(running, guest);
}

/**
 * Shuts down each emulator nobody tapped or opened an app on for `IDLE_EMULATOR_MS`. An idle
 * emulator can keep a CPU core busy, and agents leave theirs running for days.
 */
export function shutDownIdleEmulators({
  dryRun,
  report,
}: {
  dryRun: boolean;
  report: (line: string) => void;
}): void {
  const adb = path.join(
    getAndroidSdkDirectory(),
    "platform-tools",
    platform() === "win32" ? "adb.exe" : "adb",
  );

  if (!existsSync(adb)) {
    return;
  }

  const serials = read(adb, ["devices"])
    .split(/\r?\n/u)
    .flatMap((line) => parseConnectedEmulator(line))
    .map(({ serial }) => serial);

  for (const serial of serials) {
    const idle = getIdleMs({ adb, serial });

    if (idle !== undefined && idle >= IDLE_EMULATOR_MS) {
      const hours = (idle / (HOUR_S * SECOND_MS)).toFixed(1);

      if (dryRun) {
        report(`Would shut down ${serial}, unused for ${hours} h`);
      } else {
        read(adb, ["-s", serial, "emu", "kill"]);
        report(`Shut down ${serial}, unused for ${hours} h`);
      }
    }
  }
}
