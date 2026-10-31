import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";

const QUEUE_SCRIPT = join(import.meta.dirname, "queue.mts");
const ARRIVAL_GAP_MS = 150;
const ABANDONED_AGE_MS = 660_000;
const SPAWNING_TEST_TIMEOUT_MS = 60_000;
const WAITING_CHECK_MS = 3000;
const SIMULTANEOUS_JOBS = 6;
const directories: string[] = [];

function createDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "zoonk-queue-"));
  directories.push(directory);
  return directory;
}

function runQueuedJob({
  directory,
  id,
  log,
  slots,
}: {
  directory: string;
  id: number;
  log: string;
  slots: number;
}): Promise<number | null> {
  const job = `
    const { appendFileSync } = require("node:fs");
    appendFileSync(${JSON.stringify(log)}, "start ${id}\\n");
    setTimeout(() => appendFileSync(${JSON.stringify(log)}, "end ${id}\\n"), 1000);
  `;

  const { CI: _ci, ZOONK_QUEUE_TICKET: _ticket, ...environment } = process.env;

  const child = spawn(process.execPath, [QUEUE_SCRIPT, "node", "--eval", job], {
    env: {
      ...environment,
      ZOONK_QUEUE_DIR: join(directory, "queue"),
      ZOONK_QUEUE_SLOTS: String(slots),
    },
    stdio: "ignore",
  });

  return new Promise((resolve) => {
    child.once("exit", resolve);
  });
}

function readEvents(log: string): string[] {
  return readFileSync(log, "utf8").trim().split("\n");
}

function getMostAtOnce(events: string[]): number {
  return events.reduce(
    (state, event) => {
      const running = state.running + (event.startsWith("start") ? 1 : -1);
      return { most: Math.max(state.most, running), running };
    },
    { most: 0, running: 0 },
  ).most;
}

function writeTicket({
  age = 0,
  directory,
  named = "0000000000000",
  pid,
}: {
  age?: number;
  directory: string;
  named?: string;
  pid: number;
}): string {
  const ticket = join(directory, `${named}-${pid}`);
  const modified = new Date(Date.now() - age);
  writeFileSync(ticket, "");
  utimesSync(ticket, modified, modified);
  return ticket;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("pnpm dev:queue", { timeout: SPAWNING_TEST_TIMEOUT_MS }, () => {
  it("runs at most `slots` jobs at once, in the order they arrived", async () => {
    const directory = createDirectory();
    const log = join(directory, "events.log");
    const jobs: Promise<number | null>[] = [];

    for (const id of [0, 1, 2, 3]) {
      jobs.push(runQueuedJob({ directory, id, log, slots: 2 }));
      // oxlint-disable-next-line no-await-in-loop -- spaces arrivals so their order is known
      await sleep(ARRIVAL_GAP_MS);
    }

    await expect(Promise.all(jobs)).resolves.toStrictEqual([0, 0, 0, 0]);

    const events = readEvents(log);

    expect(getMostAtOnce(events)).toBe(2);

    expect(events.filter((event) => event.startsWith("start"))).toStrictEqual([
      "start 0",
      "start 1",
      "start 2",
      "start 3",
    ]);
  });

  it("keeps the limit when jobs arrive at the same moment", async () => {
    const directory = createDirectory();
    const log = join(directory, "events.log");

    const jobs = Array.from({ length: SIMULTANEOUS_JOBS }, (_, id) =>
      runQueuedJob({ directory, id, log, slots: 2 }),
    );

    await expect(Promise.all(jobs)).resolves.toStrictEqual(
      Array.from({ length: SIMULTANEOUS_JOBS }, () => 0),
    );

    expect(getMostAtOnce(readEvents(log))).toBe(2);
  });

  it("lets a ticket that appeared first go first, whatever time its name says", async () => {
    const directory = createDirectory();
    const log = join(directory, "events.log");
    const queue = join(directory, "queue");
    mkdirSync(queue);
    const earlier = writeTicket({ directory: queue, named: "9999999999999", pid: process.pid });
    const job = runQueuedJob({ directory, id: 0, log, slots: 1 });

    await sleep(WAITING_CHECK_MS);
    expect(existsSync(log)).toBe(false);

    rmSync(earlier);

    await expect(job).resolves.toBe(0);
    expect(readEvents(log)).toContain("start 0");
  });

  it("frees the turns of a job that died and of a reused PID that stopped its heartbeat", async () => {
    const directory = createDirectory();
    const log = join(directory, "events.log");
    const queue = join(directory, "queue");
    const finished = spawnSync(process.execPath, ["--eval", ""]);
    mkdirSync(queue);

    writeTicket({ directory: queue, pid: finished.pid });
    writeTicket({ age: ABANDONED_AGE_MS, directory: queue, pid: process.pid });

    await expect(runQueuedJob({ directory, id: 0, log, slots: 1 })).resolves.toBe(0);
    expect(readEvents(log)).toContain("start 0");
  });
});
