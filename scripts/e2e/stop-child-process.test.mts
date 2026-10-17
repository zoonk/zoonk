import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stopChildProcess } from "./stop-child-process.mts";

const children = new Set<ChildProcess>();

/** A real child that reports once its SIGTERM handler is installed, so the test never races startup. */
async function startChild(script: string) {
  const child = spawn(process.execPath, ["--eval", script], {
    stdio: ["ignore", "pipe", "ignore"],
  });

  children.add(child);
  const exited = Promise.withResolvers<NodeJS.Signals | null>();

  child.once("close", (_code, signal) => {
    exited.resolve(signal);
  });

  await once(child.stdout, "data");
  return { child, exited: exited.promise };
}

describe("bounded child shutdown", () => {
  afterEach(() => {
    vi.restoreAllMocks();

    /** A failed assertion must not leave a SIGTERM-ignoring child running. */
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }

    children.clear();
  });

  it("lets a child that honors SIGTERM exit on its own", async () => {
    const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);

    const { child, exited } = await startChild(
      "setInterval(() => {}, 1000); console.log('ready');",
    );

    await stopChildProcess({ child, exited, graceMs: 5000, name: "Test API" });

    await expect(exited).resolves.toBe("SIGTERM");
    expect(write).not.toHaveBeenCalled();
  });

  it("kills only that child once it outlives the grace period, and says so", async () => {
    const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);

    const { child, exited } = await startChild(
      "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000); console.log('ready');",
    );

    await stopChildProcess({ child, exited, graceMs: 200, name: "Test API" });

    await expect(exited).resolves.toBe("SIGKILL");

    expect(write).toHaveBeenCalledWith(
      `Test API (PID ${child.pid}) did not exit 0.2s after SIGTERM; sending SIGKILL.\n`,
    );
  });

  it("waits for a child that already exited without signaling it", async () => {
    const { child, exited } = await startChild("console.log('ready');");
    await exited;
    const kill = vi.spyOn(child, "kill");

    await stopChildProcess({ child, exited, name: "Test API" });

    expect(kill).not.toHaveBeenCalled();
  });
});
