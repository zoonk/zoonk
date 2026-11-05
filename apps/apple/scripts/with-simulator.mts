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
import { availableParallelism, loadavg } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  hasSimulatorSystemAppCrashed,
  listCrashReports,
} from "../../../scripts/dev/crash-reports.mts";
import { applyCommandExit, runForegroundCommand } from "../../../scripts/dev/process.mts";
import { type QueueTurn, waitForTurn } from "../../../scripts/dev/queue.mts";
import {
  type Simulator,
  type SimulatorCatalog,
  getLeasePath,
  getNewestSimulators,
  listSimulators,
} from "./simulators.mts";

// More booted at once crash Apple's simulator services on a busy Mac; a quiet one runs more. The
// limits are apps/apple/AGENTS.md's "Simulators", which agents booting by hand follow too.
const BUSY_MAX_BOOTED_SIMULATORS = 3;
const QUIET_MAX_BOOTED_SIMULATORS = 6;
const POLL_MS = 5000;
// macOS's open(2) flag for an exclusive lock, which Node doesn't export. The kernel keeps the lock
// until every process holding the file closes it, however they exit.
const O_EXLOCK = 0x20;

const CLOSE_CRASH_ALERTS_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../scripts/dev/close-device-crash-alerts.mts",
);

type Lease = { descriptor: number; device: Simulator };

/** Quiet while fewer tasks wait to run than the machine has cores. */
function getMaxBootedSimulators() {
  const [lastMinute = Infinity] = loadavg();

  return lastMinute < availableParallelism()
    ? QUIET_MAX_BOOTED_SIMULATORS
    : BUSY_MAX_BOOTED_SIMULATORS;
}

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

/** Undefined when the simulator is someone else's, or booting it would pass the limit. */
function tryLeasing(device: Simulator): Lease | undefined {
  const descriptor = tryLocking(device);

  if (descriptor === undefined) {
    return undefined;
  }

  // Read after locking: the run that just let go of it may have shut it down.
  const booted = getBootedSimulators(listSimulators());
  const isBooted = booted.some(({ udid }) => udid === device.udid);
  const isLeftBehind = fstatSync(descriptor).size > 0;

  if (isBooted ? isLeftBehind : booted.length < getMaxBootedSimulators()) {
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
 * leaves alone. A booted simulator no run leased is someone else's. Runs choose one at a time so
 * none boots past the limit.
 */
function leaseSimulator() {
  const choosing = openLocked({ flags: 0, name: "choosing" });

  try {
    // iPhone 17 last: `pnpm iphone` and older checkouts' `make test` pick it by name.
    const { devices } = getNewestSimulators({ catalog: listSimulators(), family: "iphone" });

    for (const device of devices.toReversed()) {
      const lease = tryLeasing(device);

      if (lease) {
        return lease;
      }
    }

    return { booted: getBootedSimulators(listSimulators()) };
  } finally {
    closeSync(choosing);
  }
}

/** Damaged simulator data can crash one of its iOS apps on every boot, each crash opening an alert. */
function eraseAfterSystemAppCrash({
  device,
  reportsBefore,
}: {
  device: Simulator;
  reportsBefore: Set<string>;
}) {
  if (!hasSimulatorSystemAppCrashed({ reportsBefore, udid: device.udid })) {
    return;
  }

  process.stdout.write(
    `One of iOS's own apps crashed on ${device.name}. Erasing it so the crash doesn't repeat on ` +
      `its next boot.\n`,
  );

  spawnSync("xcrun", ["simctl", "erase", device.udid], { stdio: "inherit" });
  spawnSync(process.execPath, [CLOSE_CRASH_ALERTS_SCRIPT], { stdio: "inherit" });
}

/** Gives the queue turn back while it waits, so waiting runs don't hold every slot. */
async function startRun({
  isWaiting,
}: {
  isWaiting: boolean;
}): Promise<{ lease: Lease; turn: QueueTurn | undefined }> {
  const turn = await waitForTurn();
  const attempt = leaseSimulator();

  if ("descriptor" in attempt) {
    return { lease: attempt, turn };
  }

  turn?.release();

  if (!isWaiting) {
    const names = attempt.booted.map((device) => device.name).join(", ");

    process.stderr.write(
      `Waiting for a simulator. Each test run boots a shut-down iPhone of its own, with at most ` +
        `${BUSY_MAX_BOOTED_SIMULATORS} booted at once while the machine is busy ` +
        `(${QUIET_MAX_BOOTED_SIMULATORS} while it's quiet), and booted now: ${names}. Shut down ` +
        `one you're done with, or set TEST_DESTINATION='platform=iOS Simulator,id=<udid>' to ` +
        `test on yours.\n`,
    );
  }

  await sleep(POLL_MS);
  return startRun({ isWaiting: true });
}

const [command, ...commandArguments] = process.argv.slice(2);

if (!command) {
  throw new Error("Usage: with-simulator.mts <xcodebuild command>");
}

const reportsBefore = new Set(listCrashReports());
const { lease, turn } = await startRun({ isWaiting: false });
process.stdout.write(`Testing on ${lease.device.name} (${lease.device.udid}).\n`);

try {
  applyCommandExit(
    await runForegroundCommand({
      args: [...commandArguments, "-destination", `id=${lease.device.udid}`],
      command,
      currentDirectory: process.cwd(),
      environment: { ...process.env, ...turn?.environment },
      // xcodebuild holds the lease too, so it stays taken while tests run even if this script dies.
      stdio: ["inherit", "inherit", "inherit", lease.descriptor],
    }),
  );
} finally {
  spawnSync("xcrun", ["simctl", "shutdown", lease.device.udid], { stdio: "inherit" });
  eraseAfterSystemAppCrash({ device: lease.device, reportsBefore });
  release(lease.descriptor);
  turn?.release();
}
