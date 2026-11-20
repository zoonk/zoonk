import { execFileSync } from "node:child_process";
import { lutimesSync } from "node:fs";
import path from "node:path";

const appleDirectory = path.resolve(import.meta.dirname, "..");

// Any time before every build works, since Xcode compares times for equality and its outputs must
// stay newer than their sources.
const EPOCH_SECONDS = Date.parse("2000-01-01T00:00:00Z") / 1000;
const HASH_DIGITS = 7;

/**
 * The same content always gets the same time. Changed content gets another, short of two versions
 * of one file sharing both their size and these digits of their hashes.
 */
export function contentTime(blobHash: string): number {
  return EPOCH_SECONDS + Number.parseInt(blobHash.slice(0, HASH_DIGITS), 16);
}

/** Git's `ls-files --stage -z` output as each file's path and the hash of its content. */
export function parseStagedFiles(output: string): { file: string; hash: string }[] {
  return output
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const tab = entry.indexOf("\t");
      const [, hash = ""] = entry.slice(0, tab).split(" ");
      return { file: entry.slice(tab + 1), hash };
    });
}

/**
 * Lets a CI job build on top of the build an earlier job saved, so Xcode recompiles only what
 * changed since. Xcode calls a file unchanged when its modification time and inode are the ones it
 * recorded, and a fresh checkout gives every file new ones. So each tracked file gets a time derived
 * from its content, and Xcode is told to ignore inodes.
 */
function reuseBuild() {
  const staged = execFileSync("git", ["ls-files", "--stage", "-z", "--", "."], {
    cwd: appleDirectory,
    encoding: "utf8",
    maxBuffer: Infinity,
  });

  for (const { file, hash } of parseStagedFiles(staged)) {
    const time = contentTime(hash);
    lutimesSync(path.join(appleDirectory, file), time, time);
  }

  execFileSync("defaults", [
    "write",
    "com.apple.dt.XCBuild",
    "IgnoreFileSystemDeviceInodeChanges",
    "-bool",
    "YES",
  ]);
}

if (import.meta.main) {
  reuseBuild();
}
