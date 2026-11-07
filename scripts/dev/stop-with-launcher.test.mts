import { type ChildProcessByStdio, spawn } from "node:child_process";
import { once } from "node:events";
import { type Readable } from "node:stream";
import { afterEach, expect, test } from "vitest";
import { getStopWithLauncherEnvironment } from "./process.mts";

const SPAWNING_TEST_TIMEOUT_MS = 30_000;
const AFTER_FIRST_LAUNCHER_CHECK_MS = 2500;
const IDLE = "setInterval(() => {}, 60_000);";
const SERVICE = `setTimeout(() => console.log("checked"), ${AFTER_FIRST_LAUNCHER_CHECK_MS}); ${IDLE}`;

type NodeProcess = ChildProcessByStdio<null, Readable, null>;

const children: NodeProcess[] = [];

function startNode({
  environment,
  script,
}: {
  environment: NodeJS.ProcessEnv;
  script: string;
}): NodeProcess {
  const child = spawn(process.execPath, ["--eval", script], {
    env: environment,
    stdio: ["ignore", "pipe", "inherit"],
  });

  children.push(child);
  return child;
}

function waitForExit(child: NodeProcess): Promise<{ code: number | null; signal: string | null }> {
  return new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

afterEach(() => {
  for (const child of children.splice(0)) {
    child.kill("SIGKILL");
  }
});

test(
  "stops a service once one of its launchers ends while the others still run",
  async () => {
    const runner = startNode({ environment: process.env, script: IDLE });

    const service = startNode({
      environment: {
        ...process.env,
        ...getStopWithLauncherEnvironment({
          environment: process.env,
          launcherPids: [process.pid, Number(runner.pid)],
        }),
      },
      script: SERVICE,
    });

    const exit = waitForExit(service);
    await once(service.stdout, "data");
    runner.kill("SIGKILL");

    await expect(exit).resolves.toStrictEqual({ code: null, signal: "SIGTERM" });
  },
  SPAWNING_TEST_TIMEOUT_MS,
);
