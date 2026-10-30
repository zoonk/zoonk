import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, totalmem } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { applyCommandExit, getPnpmCommand, runForegroundCommand } from "./process.mts";

const HEARTBEAT_MS = 2000;
// A running process whose ticket went this long without a heartbeat reused a finished job's PID.
const ABANDONED_TICKET_MS = 600_000;
const GIGABYTE = 1024 ** 3;

// A production build of the web apps peaks near 20 GB; more at once sends the Mac into swap.
const GIGABYTES_PER_JOB = 20;

const directory = process.env.ZOONK_QUEUE_DIR ?? join(homedir(), ".cache", "zoonk", "queue");

const slots =
  Number(process.env.ZOONK_QUEUE_SLOTS) ||
  Math.max(1, Math.floor(totalmem() / GIGABYTE / GIGABYTES_PER_JOB));

type QueueTurn = { environment: NodeJS.ProcessEnv; release: () => void };

type Ticket = { createdAt: number; name: string };

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
}

function readLiveTicket({ name, now }: { name: string; now: number }): Ticket | undefined {
  const stats = statSync(join(directory, name), { throwIfNoEntry: false });
  const pid = Number(name.split("-")[1]);

  if (!stats || now - stats.mtimeMs > ABANDONED_TICKET_MS || !isRunning(pid)) {
    return undefined;
  }

  return { createdAt: stats.birthtimeMs, name };
}

/** Ordered by when each ticket appeared, so a job joins the line the moment others can see it. */
function getLiveTickets(): string[] {
  const now = Date.now();
  const names = readdirSync(directory);
  const live = names.flatMap((name) => readLiveTicket({ name, now }) ?? []);

  for (const name of names.filter((ticket) => !live.some((alive) => alive.name === ticket))) {
    rmSync(join(directory, name), { force: true });
  }

  return live
    .toSorted(
      (first, second) =>
        first.createdAt - second.createdAt || first.name.localeCompare(second.name),
    )
    .map((ticket) => ticket.name);
}

function getPosition({ path, ticket }: { path: string; ticket: string }): number {
  if (!existsSync(path)) {
    writeFileSync(path, "");
  }

  return getLiveTickets().indexOf(ticket);
}

/**
 * Waits until this process holds one of the first `slots` live tickets, first come first served,
 * and returns nothing when there's no turn to take (CI, or already inside a queued job). Pass the
 * turn's `environment` to the job's processes, so a queued step inside it starts at once instead of
 * waiting behind it. The turn lasts until `release` or until this process exits.
 */
export async function waitForTurn(): Promise<QueueTurn | undefined> {
  if (process.env.CI || process.env.ZOONK_QUEUE_TICKET) {
    return undefined;
  }

  mkdirSync(directory, { recursive: true });
  const ticket = `${Date.now()}-${process.pid}`;
  const path = join(directory, ticket);
  writeFileSync(path, "");

  const heartbeat = setInterval(() => writeFileSync(path, ""), HEARTBEAT_MS);
  heartbeat.unref();

  function release(): void {
    clearInterval(heartbeat);
    rmSync(path, { force: true });
  }

  process.once("exit", release);
  const started = performance.now();
  let ahead = getPosition({ path, ticket });

  if (ahead >= slots) {
    process.stderr.write(`Waiting for a turn: ${ahead} jobs ahead, ${slots} run at once.\n`);
  }

  while (ahead < 0 || ahead >= slots) {
    // oxlint-disable-next-line no-await-in-loop -- polls until a slot frees up
    await sleep(HEARTBEAT_MS);
    ahead = getPosition({ path, ticket });
  }

  const waited = (performance.now() - started) / 1000;

  if (waited > 1) {
    process.stderr.write(`Got a turn after ${waited.toFixed(0)}s.\n`);
  }

  return { environment: { ZOONK_QUEUE_TICKET: ticket }, release };
}

if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);
  const turn = await waitForTurn();

  if (command) {
    const pnpm = getPnpmCommand(process.env);

    applyCommandExit(
      await runForegroundCommand({
        args: [...pnpm.args, "exec", command, ...args],
        command: pnpm.command,
        currentDirectory: process.cwd(),
        environment: { ...process.env, ...turn?.environment },
      }),
    );
  }
}
