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

function download(directory: string) {
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
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
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
 * safely, but xcodebuild fails when several fill an empty folder at once, so one downloads it alone.
 */
export function prepareSwiftPackages(): string {
  const version = createHash("sha256").update(readFileSync(resolvedPath)).digest("hex");
  const directory = path.join(swiftPackagesDirectory, version.slice(0, VERSION_DIGITS));
  const ready = path.join(directory, READY_FILE);

  if (!existsSync(ready)) {
    const lock = openExclusiveLock({ lockPath: `${directory}.lock` });

    try {
      if (!existsSync(ready)) {
        download(directory);
      }
    } finally {
      closeSync(lock);
    }
  }

  writeFileSync(ready, "");
  return directory;
}

// With a command, runs it with the shared packages; alone, prints their folder for `xcodebuild`.
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);
  const directory = prepareSwiftPackages();

  if (command) {
    applyCommandExit(
      await runForegroundCommand({
        args: ["-clonedSourcePackagesDirPath", directory, ...args],
        command,
        currentDirectory: process.cwd(),
        environment: process.env,
      }),
    );
  } else {
    process.stdout.write(`${directory}\n`);
  }
}
