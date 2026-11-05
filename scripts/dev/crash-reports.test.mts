import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SIMULATOR = "ABA7F185-16AC-4437-B895-3AA3AE5945FC";
const OTHER_SIMULATOR = "9DD8A596-DFB4-47D1-9749-71538F72D8BB";
const POSTER_BOARD = "/Volumes/VOLUME/*/PosterBoard.app/PosterBoard";

const POSTER_EXTENSION =
  "/Volumes/VOLUME/*/KaleidoscopePosterApp.app/Extensions/KaleidoscopePoster.appex/KaleidoscopePoster";

const DAEMON = "/Volumes/VOLUME/*/IntelligenceTasksEngine.framework/Support/intelligencetasksd";
const INSTALLED_APP = `/Users/USER/Library/Developer/CoreSimulator/Devices/${SIMULATOR}/data/Containers/Bundle/Application/AAD0312F-3EDD-4868-9C61-E4D2C8C5C08D/Zoonk.app/Zoonk`;

type Reports = Record<string, { processPath: string; udid: string }>;

let home = "";

function getReportsDirectory() {
  return path.join(home, "Library", "Logs", "DiagnosticReports");
}

/** The shape macOS writes: a header line, then the body with escaped slashes. */
function formatReport({ processPath, udid }: { processPath: string; udid: string }) {
  return [
    '{"app_name":"Process","bug_type":"309"}',
    "{",
    `  "procPath" : "${processPath.replaceAll("/", String.raw`\/`)}",`,
    `  "coalitionName" : "com.apple.CoreSimulator.SimDevice.${udid}",`,
    "}",
  ].join("\n");
}

function writeReports(reports: Reports) {
  mkdirSync(getReportsDirectory(), { recursive: true });

  for (const [file, report] of Object.entries(reports)) {
    writeFileSync(path.join(getReportsDirectory(), file), formatReport(report));
  }
}

async function hasCrashedDuringRun({
  after,
  before = {},
  udid = SIMULATOR,
}: {
  after: Reports;
  before?: Reports;
  udid?: string;
}) {
  const { hasSimulatorSystemAppCrashed, listCrashReports } = await import("./crash-reports.mts");
  writeReports(before);
  const reportsBefore = new Set(listCrashReports());
  writeReports(after);
  return hasSimulatorSystemAppCrashed({ reportsBefore, udid });
}

beforeEach(() => {
  home = mkdtempSync(path.join(tmpdir(), "zoonk-crash-reports-"));
  vi.stubEnv("HOME", home);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(home, { force: true, recursive: true });
});

describe("hasSimulatorSystemAppCrashed", () => {
  it("finds a crash of one of the simulator's iOS apps", async () => {
    await expect(
      hasCrashedDuringRun({
        after: {
          "PosterBoard-2026-11-05-142149.ips": { processPath: POSTER_BOARD, udid: SIMULATOR },
        },
      }),
    ).resolves.toBe(true);
  });

  it("finds a crash of an iOS app's extension", async () => {
    await expect(
      hasCrashedDuringRun({
        after: {
          "KaleidoscopePoster-2026-11-03-012253.ips": {
            processPath: POSTER_EXTENSION,
            udid: SIMULATOR,
          },
        },
      }),
    ).resolves.toBe(true);
  });

  it("ignores daemons, installed apps and other simulators", async () => {
    await expect(
      hasCrashedDuringRun({
        after: {
          "PosterBoard-2026-11-05-142149.ips": { processPath: POSTER_BOARD, udid: OTHER_SIMULATOR },
          "Zoonk-2026-11-05-142201.ips": { processPath: INSTALLED_APP, udid: SIMULATOR },
          "intelligencetasksd-2026-11-05-140233.ips": { processPath: DAEMON, udid: SIMULATOR },
        },
      }),
    ).resolves.toBe(false);
  });

  it("ignores reports written before the run", async () => {
    await expect(
      hasCrashedDuringRun({
        after: {},
        before: {
          "PosterBoard-2026-11-05-142149.ips": { processPath: POSTER_BOARD, udid: SIMULATOR },
        },
      }),
    ).resolves.toBe(false);
  });

  it("works on a Mac with no reports folder", async () => {
    const { hasSimulatorSystemAppCrashed, listCrashReports } = await import("./crash-reports.mts");

    expect(listCrashReports()).toStrictEqual([]);
    expect(hasSimulatorSystemAppCrashed({ reportsBefore: new Set(), udid: SIMULATOR })).toBe(false);
  });
});
