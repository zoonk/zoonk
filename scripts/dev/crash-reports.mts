import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const REPORTS_DIRECTORY = path.join(homedir(), "Library", "Logs", "DiagnosticReports");
const SIMULATOR_COALITION = '"coalitionName" : "com.apple.CoreSimulator.SimDevice.';
const PROCESS_PATH = '"procPath" : "';
// Reports redact the home folder to USER; the SDK's default location is ~/Library/Android/sdk.
const ANDROID_SDK_PROCESS = String.raw`"procPath" : "\/Users\/USER\/Library\/Android\/`;
// Reports redact where Xcode mounts the simulator's iOS to /Volumes/VOLUME; apps installed on the
// simulator, like Zoonk, run from its data folder instead.
const SIMULATOR_SYSTEM_PROCESS = String.raw`"procPath" : "\/Volumes\/VOLUME\/`;
const APP_BUNDLE = String.raw`.app\/`;

/** Empty on a Mac that has no reports folder because nothing has crashed on it yet. */
export function listCrashReports() {
  if (!existsSync(REPORTS_DIRECTORY)) {
    return [];
  }

  return readdirSync(REPORTS_DIRECTORY).filter((file) => file.endsWith(".ips"));
}

function readCrashReport(file: string) {
  return readFileSync(path.join(REPORTS_DIRECTORY, file), "utf8");
}

export function isDeviceCrash(processName: string) {
  // Report names end in their crash time; macOS rewrites old reports, so their mtimes can't order them.
  const newestReport = listCrashReports()
    .filter((file) => file.startsWith(`${processName}-`))
    .toSorted()
    .at(-1);

  if (newestReport === undefined) {
    return false;
  }

  const report = readCrashReport(newestReport);
  return report.includes(SIMULATOR_COALITION) || report.includes(ANDROID_SDK_PROCESS);
}

function getSimulatorAppCrash({ report, udid }: { report: string; udid: string }) {
  const processPath = report.split("\n").find((line) => line.includes(PROCESS_PATH)) ?? "";

  if (!report.includes(`${SIMULATOR_COALITION}${udid}"`) || !processPath.includes(APP_BUNDLE)) {
    return;
  }

  return { isSystemApp: processPath.includes(SIMULATOR_SYSTEM_PROCESS) };
}

/**
 * Apps that crashed on the simulator in reports written after `reportsBefore` was listed. Each app
 * crash opens a "quit unexpectedly" alert on the Mac; the iOS daemons that crash often on
 * simulators don't.
 */
export function findSimulatorAppCrashes({
  reportsBefore,
  udid,
}: {
  reportsBefore: Set<string>;
  udid: string;
}) {
  return listCrashReports()
    .filter((file) => !reportsBefore.has(file))
    .map((file) => getSimulatorAppCrash({ report: readCrashReport(file), udid }))
    .filter((crash) => crash !== undefined);
}
