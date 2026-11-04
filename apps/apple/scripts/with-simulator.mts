import { spawnSync } from "node:child_process";
import {
  closeSync,
  constants,
  fstatSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { applyCommandExit, runForegroundCommand } from "../../../scripts/dev/process.mts";
import { type QueueTurn, waitForTurn } from "../../../scripts/dev/queue.mts";
import {
  type Simulator,
  type SimulatorCatalog,
  getLeasePath,
  getNewestSimulators,
  listSimulators,
} from "./simulators.mts";

// More booted at once crash Apple's simulator services on a busy Mac.
const MAX_BOOTED_SIMULATORS = 3;
const POLL_MS = 5000;
// macOS's open(2) flag for an exclusive lock, which Node doesn't export. The kernel keeps the lock
// until every process holding the file closes it, however they exit.
const O_EXLOCK = 0x20;

type Lease = { descriptor: number; device: Simulator };

function isShutDown(device: Simulator) {
  return device.state === "Shutdown";
}

function getBootedSimulators(catalog: SimulatorCatalog) {
  return Object.values(catalog.devices)
    .flat()
    .filter((device) => !isShutDown(device));
}

/** Lock files stay in place: removing one lets a run lock it while another locks its replacement. */
function openLocked({ flags, name }: { flags: number; name: string }) {
  const lockPath = getLeasePath(name);
  mkdirSync(path.dirname(lockPath), { recursive: true });
  // oxlint-disable-next-line no-bitwise -- open(2) takes its flags as bits
  return openSync(lockPath, constants.O_RDWR | constants.O_CREAT | O_EXLOCK | flags);
}

function tryLocking(device: Simulator): number | undefined {
  try {
    return openLocked({ flags: constants.O_NONBLOCK, name: device.udid });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EAGAIN") {
      return undefined;
    }

    throw error;
  }
}

/**
 * The lease names its run until released, so a run that's killed leaves its simulator marked. It
 * writes before truncating, so a lease taken over from a killed run never looks free.
 */
function claim(descriptor: number) {
  const owner = String(process.pid);
  writeSync(descriptor, owner, 0);
  ftruncateSync(descriptor, Buffer.byteLength(owner));
}

function release(descriptor: number) {
  ftruncateSync(descriptor);
  closeSync(descriptor);
}

/** False when something else booted the simulator first. */
function bootSimulator(device: Simulator) {
  const boot = spawnSync("xcrun", ["simctl", "boot", device.udid], { encoding: "utf8" });

  if (boot.status === 0) {
    return true;
  }

  if (getBootedSimulators(listSimulators()).some(({ udid }) => udid === device.udid)) {
    return false;
  }

  throw new Error(`Couldn't boot ${device.name}: ${boot.stderr.trim()}`);
}

/**
 * Undefined when the simulator is someone else's, or booting it would pass the limit. A booted one
 * nobody leased is someone else's, unless a killed run left it marked or a hold names it.
 */
function tryLeasing({
  device,
  isNamed,
}: {
  device: Simulator;
  isNamed: boolean;
}): Lease | undefined {
  const descriptor = tryLocking(device);

  if (descriptor === undefined) {
    return undefined;
  }

  // Read after locking: the run that just let go of it may have shut it down.
  const booted = getBootedSimulators(listSimulators());
  const isBooted = booted.some(({ udid }) => udid === device.udid);
  const isLeftBehind = fstatSync(descriptor).size > 0;

  if (isBooted ? isNamed || isLeftBehind : booted.length < MAX_BOOTED_SIMULATORS) {
    claim(descriptor);

    if (isBooted || bootSimulator(device)) {
      return { descriptor, device };
    }
  }

  release(descriptor);
  return undefined;
}

/**
 * Two runs can't share a simulator: the app hosts the tests and runs once per simulator, and
 * xcodebuild shuts down a simulator it booted as soon as its own run ends. So each run leases its
 * own: one a killed run left booted, or a shut-down one it boots itself, which xcodebuild then
 * leaves alone. A booted simulator nobody leased is someone else's. Runs and holds choose one at a
 * time so none boots past the limit.
 */
function leaseSimulator(named?: string) {
  const choosing = openLocked({ flags: 0, name: "choosing" });

  try {
    const { devices } = getNewestSimulators({ catalog: listSimulators(), family: "iphone" });

    // iPhone 17 last: `pnpm iphone` and older checkouts' `make test` pick it by name.
    const candidates = named
      ? devices.filter(({ name, udid }) => named === name || named === udid)
      : devices.toReversed();

    if (candidates.length === 0) {
      const names = devices.map(({ name }) => name).join(", ");
      throw new Error(`${named} isn't one of Xcode's own iPhone simulators: ${names}.`);
    }

    for (const device of candidates) {
      const lease = tryLeasing({ device, isNamed: Boolean(named) });

      if (lease) {
        return lease;
      }
    }

    return { booted: getBootedSimulators(listSimulators()) };
  } finally {
    closeSync(choosing);
  }
}

function describeWait({ booted, named }: { booted: Simulator[]; named?: string }) {
  const names = booted.map((device) => device.name).join(", ");

  if (named) {
    return (
      `Waiting for ${named} while a test run or another hold has it, or until fewer than ` +
      `${MAX_BOOTED_SIMULATORS} simulators are booted (booted now: ${names}).\n`
    );
  }

  return (
    `Waiting for a simulator. Each test run boots a shut-down iPhone of its own, with at most ` +
    `${MAX_BOOTED_SIMULATORS} booted at once, and booted now: ${names}. Shut down one you're ` +
    `done with, or set TEST_DESTINATION='platform=iOS Simulator,id=<udid>' to test on yours.\n`
  );
}

/** Gives the queue turn back while it waits, so waiting runs don't hold every slot. */
async function startRun({
  isWaiting,
  named,
}: {
  isWaiting: boolean;
  named?: string;
}): Promise<{ lease: Lease; turn: QueueTurn | undefined }> {
  const turn = await waitForTurn();
  const attempt = leaseSimulator(named);

  if ("descriptor" in attempt) {
    return { lease: attempt, turn };
  }

  turn?.release();

  if (!isWaiting) {
    process.stderr.write(describeWait({ booted: attempt.booted, named }));
  }

  await sleep(POLL_MS);
  return startRun({ isWaiting: true, named });
}

async function test({ args, command }: { args: string[]; command: string }) {
  const { lease, turn } = await startRun({ isWaiting: false });
  process.stdout.write(`Testing on ${lease.device.name} (${lease.device.udid}).\n`);

  try {
    applyCommandExit(
      await runForegroundCommand({
        args: [...args, "-destination", `id=${lease.device.udid}`],
        command,
        currentDirectory: process.cwd(),
        environment: { ...process.env, ...turn?.environment },
        // xcodebuild holds the lease too, so it stays taken while tests run even if this script dies.
        stdio: ["inherit", "inherit", "inherit", lease.descriptor],
      }),
    );
  } finally {
    spawnSync("xcrun", ["simctl", "shutdown", lease.device.udid], { stdio: "inherit" });
    release(lease.descriptor);
    turn?.release();
  }
}

/**
 * For a simulator someone drives by hand, such as in a walk. Unlike a test run's, it stays booted
 * once released, still theirs: test runs leave a booted simulator nobody leased alone.
 */
async function hold(named: string) {
  const { lease, turn } = await startRun({ isWaiting: false, named });
  turn?.release();
  process.stdout.write(`Holding ${lease.device.name} (${lease.device.udid}) until stopped.\n`);
  // oxlint-disable-next-line no-empty-function -- a timer keeps Node running; signal listeners don't
  const keepAlive = setInterval(() => {}, POLL_MS);

  await new Promise((resolve) => {
    for (const signal of ["SIGHUP", "SIGINT", "SIGTERM"]) {
      process.once(signal, resolve);
    }
  });

  clearInterval(keepAlive);
  release(lease.descriptor);
}

const [command, ...commandArguments] = process.argv.slice(2);

if (command === "--hold" && commandArguments[0]) {
  await hold(commandArguments[0]);
} else if (command && command !== "--hold") {
  await test({ args: commandArguments, command });
} else {
  throw new Error(
    "Usage: with-simulator.mts <xcodebuild command> | --hold <simulator name or udid>",
  );
}
