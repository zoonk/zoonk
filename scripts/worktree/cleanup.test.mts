import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stopProcessesInRemovedDirectories } from "./cleanup.mts";

const hasLsof = !spawnSync("lsof", ["-v"]).error;
const children: ChildProcess[] = [];

function startIdleProcess(cwd: string): ChildProcess {
  const child = spawn(process.execPath, ["--eval", "setInterval(() => {}, 1000)"], { cwd });
  children.push(child);
  return child;
}

function exited(child: ChildProcess): Promise<NodeJS.Signals | null> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(child.signalCode);
  }

  return new Promise((resolve) => {
    child.once("exit", (_code, signal) => resolve(signal));
  });
}

afterEach(() => {
  for (const child of children.splice(0)) {
    child.kill("SIGKILL");
  }
});

describe.skipIf(!hasLsof)(stopProcessesInRemovedDirectories, () => {
  it("stops processes running from a removed folder and leaves a sibling with the same prefix", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "zoonk-cleanup-")));
    const removed = join(root, "wt");
    const sibling = join(root, "wt-2");
    mkdirSync(join(removed, "apps"), { recursive: true });
    mkdirSync(sibling);

    const inRemoved = startIdleProcess(join(removed, "apps"));
    const inSibling = startIdleProcess(sibling);
    rmSync(removed, { recursive: true });

    const stopped = await stopProcessesInRemovedDirectories([removed]);

    expect(stopped).toStrictEqual([inRemoved.pid]);
    await expect(exited(inRemoved)).resolves.toBe("SIGTERM");
    expect(inSibling.exitCode).toBeNull();

    rmSync(root, { force: true, recursive: true });
  });

  it("leaves a worktree that came back at the same path", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "zoonk-cleanup-")));
    const recreated = join(root, "wt");
    mkdirSync(recreated);
    const inRecreated = startIdleProcess(recreated);

    await expect(stopProcessesInRemovedDirectories([recreated])).resolves.toStrictEqual([]);
    expect(inRecreated.exitCode).toBeNull();

    rmSync(root, { force: true, recursive: true });
  });

  it("signals nothing when no worktree was removed", async () => {
    await expect(stopProcessesInRemovedDirectories([])).resolves.toStrictEqual([]);
  });
});
