// Worktree setup starts this file with `node` before a new worktree has dependencies, so nothing it
// imports may come from node_modules.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  type Dirent,
  appendFileSync,
  closeSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statfsSync,
} from "node:fs";
import { homedir, userInfo } from "node:os";
import path from "node:path";
import { READY_FILE, swiftPackagesDirectory } from "../../apps/apple/scripts/swift-packages.mts";
import { trimSimulators } from "../../apps/apple/scripts/trim-simulators.mts";
import { tryExclusiveLock } from "../dev/exclusive-lock.mts";
import { isInside, listProcessDirectories } from "./cleanup.mts";
import { run } from "./postgres.mts";

const HOUR_MS = 60 * 60 * 1000;

/** Build output nobody touched for this long belongs to a task that stopped; one that resumes rebuilds. */
export const IDLE_MS = 12 * HOUR_MS;
const UNUSED_SWIFT_PACKAGES_MS = 7 * 24 * HOUR_MS;

// Deep enough for a scratch or review folder's copied checkout, such as task/build/lane/apple/DerivedData.
const MAX_DEPTH = 8;

/** Xcode logs a build two folders below its build folder, which is where `lastChange` looks. */
const CHANGE_DEPTH = 3;

const repository = realpathSync(path.resolve(import.meta.dirname, "../.."));
const cacheDirectory = path.join(homedir(), ".cache", "zoonk");
const trashDirectory = path.join(cacheDirectory, "trash");
const logPath = path.join(cacheDirectory, "sweep.log");

// Leads keep their notes, reports and evidence here, and copied builds pile up beside them.
const reviewDirectory = path.join(homedir(), "zoonk-review");

const GRADLE_SCRIPTS = [
  "build.gradle.kts",
  "settings.gradle.kts",
  "build.gradle",
  "settings.gradle",
];

function realPath(target: string): string {
  try {
    return realpathSync(target);
  } catch {
    return target;
  }
}

/** A folder Xcode builds into, whatever `-derivedDataPath` named it. */
function isXcodeBuildFolder(names: Set<string>): boolean {
  return names.has("info.plist") && (names.has("Build") || names.has("SourcePackages"));
}

// What Xcode remakes in its build folder. Its `Logs` keep test results, which no build brings back.
const XCODE_OUTPUTS = new Set([
  "Build",
  "CompilationCache.noindex",
  "Index.noindex",
  "ModuleCache.noindex",
  "SDKExplicitPrecompiledModules",
  "SDKStatCaches.noindex",
  "SourcePackages",
]);

function isBuildOutput({
  inWorktree,
  name,
  siblings,
}: {
  inWorktree: boolean;
  name: string;
  siblings: Set<string>;
}): boolean {
  if (name === ".next" || name === ".next-e2e") {
    return true;
  }

  if (name === "build" || name === ".gradle" || name === ".kotlin") {
    return GRADLE_SCRIPTS.some((script) => siblings.has(script));
  }

  // A worktree's dependencies cost little, since pnpm clones them from its store, and every command needs them.
  return name === "node_modules" && !inWorktree;
}

function readEntries(directory: string): Dirent[] {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Folders under `root` that a build makes and remakes, without entering the ones in `skip`. */
export function findBuildOutputs({
  inWorktree,
  root,
  skip = new Set(),
}: {
  inWorktree: boolean;
  root: string;
  skip?: Set<string>;
}): string[] {
  const found: string[] = [];

  function visit(directory: string, depth: number): void {
    if (skip.has(directory)) {
      return;
    }

    const entries = readEntries(directory);
    const names = new Set(entries.map(({ name }) => name));

    if (depth > 0 && isXcodeBuildFolder(names)) {
      found.push(
        ...entries
          .filter((entry) => entry.isDirectory() && XCODE_OUTPUTS.has(entry.name))
          .map(({ name }) => path.join(directory, name)),
      );

      return;
    }

    const folders = entries.filter((entry) => entry.isDirectory() && entry.name !== ".git");

    for (const { name } of folders) {
      const child = path.join(directory, name);

      if (isBuildOutput({ inWorktree, name, siblings: names })) {
        found.push(child);
      } else if (depth < MAX_DEPTH && !(inWorktree && name === "node_modules")) {
        visit(child, depth + 1);
      }
    }
  }

  visit(root, 0);
  return found;
}

/** The newest modification time of `target` and what's up to `depth` folders below it. */
export function lastChange(target: string, depth = CHANGE_DEPTH): number {
  const stats = lstatSync(target, { throwIfNoEntry: false });

  if (!stats) {
    return 0;
  }

  if (!stats.isDirectory() || depth === 0) {
    return stats.mtimeMs;
  }

  return readEntries(target).reduce(
    (newest, entry) => Math.max(newest, lastChange(path.join(target, entry.name), depth - 1)),
    stats.mtimeMs,
  );
}

function gitActivity(worktree: string): number {
  try {
    const pointer = readFileSync(path.join(worktree, ".git"), "utf8").trim();
    const gitDirectory = path.resolve(worktree, pointer.replace(/^gitdir: /u, ""));

    return Math.max(
      ...["index", "HEAD", path.join("logs", "HEAD")].map((file) =>
        lastChange(path.join(gitDirectory, file), 0),
      ),
    );
  } catch {
    return Date.now();
  }
}

async function listWorktrees(): Promise<string[]> {
  const listing = await run({
    args: ["worktree", "list", "--porcelain"],
    command: "git",
    cwd: repository,
  });

  return listing
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => realPath(line.slice("worktree ".length)));
}

function listScratchRoots(): string[] {
  const temporary = realPath("/tmp");
  const { uid } = userInfo();

  const owned = readEntries(temporary)
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => path.join(temporary, name))
    .filter((directory) => lstatSync(directory, { throwIfNoEntry: false })?.uid === uid);

  return [reviewDirectory, ...owned];
}

function freeBytes(): number {
  const { bavail, bsize } = statfsSync(homedir());
  return bavail * bsize;
}

function report(line: string): void {
  const stamped = `${new Date().toISOString()} ${line}\n`;
  process.stdout.write(stamped);
  appendFileSync(logPath, stamped);
}

/**
 * Moves the folder into the trash, which the sweep empties once everything is moved, so a build that
 * starts meanwhile finds it either whole or gone, never half deleted.
 */
function moveToTrash(target: string): void {
  try {
    renameSync(target, path.join(trashDirectory, randomUUID()));
    report(`Removed ${target}`);
  } catch (error) {
    report(`Kept ${target}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function removeUnusedSwiftPackages({
  now,
  remove,
}: {
  now: number;
  remove: (target: string) => void;
}): void {
  const isUnused = (directory: string) =>
    now - lastChange(path.join(directory, READY_FILE), 0) >= UNUSED_SWIFT_PACKAGES_MS;

  const unused = readEntries(swiftPackagesDirectory)
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => path.join(swiftPackagesDirectory, name))
    .filter((directory) => isUnused(directory));

  for (const directory of unused) {
    // A build holds the lock while it downloads the folder.
    const lock = tryExclusiveLock(`${directory}.lock`);

    if (lock !== undefined) {
      if (isUnused(directory)) {
        remove(directory);
      }

      closeSync(lock);
    }
  }
}

/**
 * Deletes build output that tasks left behind and every build remakes: in worktrees nobody worked in
 * for `IDLE_MS`, in scratch and review folders, Swift packages no build used for a week, and
 * simulators' wallpaper snapshots. Never where a process is running.
 */
export async function sweep({ dryRun = false }: { dryRun?: boolean } = {}): Promise<void> {
  const remove = dryRun ? (target: string) => report(`Would remove ${target}`) : moveToTrash;
  const now = Date.now();
  const freeBefore = freeBytes();
  const worktrees = await listWorktrees();
  const isIdle = (output: string) => now - lastChange(output) >= IDLE_MS;

  // The first worktree is the main checkout, which holds someone's own work.
  const idleWorktreeOutputs = worktrees
    .slice(1)
    .filter((worktree) => worktree !== repository)
    .flatMap((worktree) => {
      const outputs = findBuildOutputs({ inWorktree: true, root: worktree });
      const changedAt = Math.max(gitActivity(worktree), ...outputs.map((item) => lastChange(item)));

      return now - changedAt >= IDLE_MS ? outputs.map((output) => ({ output, owner: worktree })) : [];
    });

  const idleScratchOutputs = listScratchRoots().flatMap((root) =>
    findBuildOutputs({ inWorktree: false, root, skip: new Set(worktrees) })
      .filter((output) => isIdle(output))
      .map((output) => ({ output, owner: path.dirname(output) })),
  );

  // Listed after the slow scan, so a task that started meanwhile keeps its builds.
  const processes = await listProcessDirectories();

  const isBusy = (directory: string) =>
    processes.some((item) => isInside({ directories: [directory], path: item.directory }));

  if (!dryRun) {
    rmSync(trashDirectory, { force: true, recursive: true });
    mkdirSync(trashDirectory, { recursive: true });
  }

  for (const { output, owner } of [...idleWorktreeOutputs, ...idleScratchOutputs]) {
    if (!isBusy(owner) && isIdle(output)) {
      remove(output);
    }
  }

  removeUnusedSwiftPackages({ now, remove });

  if (process.platform === "darwin") {
    trimSimulators(remove);
  }

  if (!dryRun) {
    rmSync(trashDirectory, { force: true, recursive: true });
  }

  const freed = (freeBytes() - freeBefore) / 1024 ** 3;
  report(`Sweep finished; free space changed by ${freed.toFixed(1)} GB.`);
}

/** Runs the sweep apart from the caller, which doesn't wait for it; one sweep runs at a time. */
export function startSweep(): void {
  spawn(process.execPath, [import.meta.filename], { detached: true, stdio: "ignore" }).unref();
}

if (import.meta.main) {
  mkdirSync(cacheDirectory, { recursive: true });

  if (tryExclusiveLock(`${logPath}.lock`) === undefined) {
    process.stdout.write("Another sweep is running.\n");
  } else {
    await sweep({ dryRun: process.argv.includes("--dry-run") });
  }
}
