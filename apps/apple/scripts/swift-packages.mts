import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { openExclusiveLock } from "../../../scripts/dev/exclusive-lock.mts";
import { applyCommandExit, runForegroundCommand } from "../../../scripts/dev/process.mts";

const appleDirectory = path.resolve(import.meta.dirname, "..");
const projectPath = path.join(appleDirectory, "Zoonk.xcodeproj");

const resolvedPath = path.join(
  projectPath,
  "project.xcworkspace",
  "xcshareddata",
  "swiftpm",
  "Package.resolved",
);

const VERSION_DIGITS = 16;

export const swiftPackagesDirectory = path.join(homedir(), ".cache", "zoonk", "swift-packages");

/** Its time is when a build last used the folder, which is how the sweep finds unused versions. */
export const READY_FILE = ".ready";

function download({ directory, lock }: { directory: string; lock: number }) {
  process.stderr.write("Downloading the Swift packages once for every checkout on this Mac…\n");
  rmSync(directory, { force: true, recursive: true });
  const derivedData = mkdtempSync(path.join(tmpdir(), "zoonk-swift-packages-"));

  const result = spawnSync(
    "xcodebuild",
    [
      "-resolvePackageDependencies",
      "-skipPackagePluginValidation",
      "-packageAuthorizationProvider",
      "netrc",
      "-project",
      projectPath,
      "-scheme",
      "Zoonk",
      "-derivedDataPath",
      derivedData,
      "-clonedSourcePackagesDirPath",
      directory,
      "-onlyUsePackageVersionsFromResolvedFile",
    ],
    // The resolver holds the lock too, so it stays taken if this script dies mid-download.
    { stdio: ["ignore", "ignore", "inherit", lock] },
  );

  rmSync(derivedData, { force: true, recursive: true });

  if (result.status !== 0) {
    rmSync(directory, { force: true, recursive: true });
    throw new Error(`Downloading the Swift packages failed (exit ${result.status}).`);
  }

  writeFileSync(path.join(directory, READY_FILE), "");
}

/**
 * Checkouts with the same Package.resolved share one copy of the Swift packages, about 4 GB that
 * each build folder would otherwise download for itself. Builds read a downloaded copy in parallel
 * safely, but xcodebuild fails when several fill an empty folder at once, so one downloads it alone,
 * and the sweep removes an unused version only while holding the same lock.
 */
function prepareSwiftPackages(): string {
  const version = createHash("sha256").update(readFileSync(resolvedPath)).digest("hex");
  const directory = path.join(swiftPackagesDirectory, version.slice(0, VERSION_DIGITS));
  const ready = path.join(directory, READY_FILE);
  const lock = openExclusiveLock({ lockPath: `${directory}.lock` });

  try {
    if (!existsSync(ready)) {
      download({ directory, lock });
    }

    writeFileSync(ready, "");
  } finally {
    closeSync(lock);
  }

  return directory;
}

/**
 * The shared folder only ever holds Package.resolved's versions, so a checkout that changes a
 * requirement can't move the packages under another checkout's build; it resolves without these.
 */
export function swiftPackagesArguments(): string[] {
  return [
    "-clonedSourcePackagesDirPath",
    prepareSwiftPackages(),
    "-onlyUsePackageVersionsFromResolvedFile",
  ];
}

// With a command, runs it with the shared packages; alone, prints the arguments for `xcodebuild`.
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);

  if (command) {
    applyCommandExit(
      await runForegroundCommand({
        args: [...swiftPackagesArguments(), ...args],
        command,
        currentDirectory: process.cwd(),
        environment: process.env,
      }),
    );
  } else {
    process.stdout.write(`${swiftPackagesArguments().join(" ")}\n`);
  }
}
