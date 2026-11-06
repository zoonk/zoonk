import { spawnSync } from "node:child_process";
import { closeSync, constants, fstatSync, ftruncateSync, writeSync } from "node:fs";
import { availableParallelism, homedir, loadavg } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { listCrashReports } from "../../../scripts/dev/crash-reports.mts";
import { openExclusiveLock } from "../../../scripts/dev/exclusive-lock.mts";
import { type QueueTurn, waitForTurn } from "../../../scripts/dev/queue.mts";
import { type Simulator, listSimulators } from "./simulators.mts";

// More booted at once crash Apple's simulator services on a busy Mac; a quiet one runs more. The
// limits are apps/apple/AGENTS.md's "Simulators", which agents booting by hand follow too.
const BUSY_MAX_BOOTED_SIMULATORS = 3;
const QUIET_MAX_BOOTED_SIMULATORS = 6;
export const POLL_MS = 5000;

export const BOOT_LIMIT =
  `at most ${BUSY_MAX_BOOTED_SIMULATORS} booted at once while the machine is busy ` +
  `(${QUIET_MAX_BOOTED_SIMULATORS} while it's quiet)`;

const leaseDirectory = path.join(homedir(), ".cache", "zoonk", "simulators");

export type Lease = { descriptor: number; device: Simulator; reportsBefore: Set<string> };

/** Quiet while fewer tasks wait to run than the machine has cores. */
function getMaxBootedSimulators() {
  const [lastMinute = Infinity] = loadavg();

  return lastMinute < availableParallelism()
    ? QUIET_MAX_BOOTED_SIMULATORS
    : BUSY_MAX_BOOTED_SIMULATORS;
}

export function getBootedSimulators(): Simulator[] {
  return Object.values(listSimulators().devices)
    .flat()
    .filter((device) => device.state !== "Shutdown");
}

function tryLocking(device: Simulator): number | undefined {
  try {
    return openExclusiveLock({
      flags: constants.O_NONBLOCK,
      lockPath: path.join(leaseDirectory, device.udid),
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EAGAIN") {
      return undefined;
    }

    throw error;
  }
}

/** A test run's lease names it until released, so a run that's killed leaves its simulator marked. */
function markAsTestRun(descriptor: number) {
  const owner = String(process.pid);
  writeSync(descriptor, owner, 0);
  ftruncateSync(descriptor, Buffer.byteLength(owner));
}

export function releaseLease({ descriptor }: { descriptor: number }) {
  ftruncateSync(descriptor);
  closeSync(descriptor);
}

/** False when something else booted the simulator first. */
function bootSimulator(device: Simulator) {
  const boot = spawnSync("xcrun", ["simctl", "boot", device.udid], { encoding: "utf8" });

  if (boot.status === 0) {
    return true;
  }

  if (getBootedSimulators().some(({ udid }) => udid === device.udid)) {
    return false;
  }

  throw new Error(`Couldn't boot ${device.name}: ${boot.stderr.trim()}`);
}

/**
 * Undefined when booting the locked simulator would pass the limit. To a test run, a booted
 * simulator is someone else's unless a killed run left it marked. Someone driving one by hand takes
 * the booted one they chose, and clears a killed run's mark: it's theirs now, and stays theirs
 * however their lease ends.
 */
function tryLeasing({
  descriptor,
  device,
  isTestRun,
}: {
  descriptor: number;
  device: Simulator;
  isTestRun: boolean;
}): Lease | undefined {
  // Read after locking: the run that just let go of it may have shut it down.
  const booted = getBootedSimulators();
  const isBooted = booted.some(({ udid }) => udid === device.udid);
  const isLeftBehind = fstatSync(descriptor).size > 0;

  if (isBooted ? !isTestRun || isLeftBehind : booted.length < getMaxBootedSimulators()) {
    if (isTestRun) {
      markAsTestRun(descriptor);
    } else {
      ftruncateSync(descriptor);
    }

    const reportsBefore = new Set(listCrashReports());

    if (isBooted || bootSimulator(device)) {
      return { descriptor, device, reportsBefore };
    }
  }

  releaseLease({ descriptor });
  return undefined;
}

/**
 * Two runs can't share a simulator: the app hosts the tests and runs once per simulator, and
 * xcodebuild shuts down a simulator it booted as soon as its own run ends. So each run leases its
 * own: one a killed run left booted, or a shut-down one it boots itself, which xcodebuild then
 * leaves alone. Leases are chosen one at a time so none boots past the limit.
 */
function chooseSimulator({
  getCandidates,
  isTestRun,
}: {
  getCandidates: () => Simulator[];
  isTestRun: boolean;
}): Lease | { booted: Simulator[] } {
  const choosing = openExclusiveLock({ lockPath: path.join(leaseDirectory, "choosing") });

  try {
    for (const device of getCandidates()) {
      const descriptor = tryLocking(device);

      if (descriptor !== undefined) {
        const lease = tryLeasing({ descriptor, device, isTestRun });

        if (lease) {
          return lease;
        }

        // By hand, wait for the first one nobody holds rather than take someone else's booted one.
        if (!isTestRun) {
          break;
        }
      }
    }

    return { booted: getBootedSimulators() };
  } finally {
    closeSync(choosing);
  }
}

/**
 * Leases the first candidate free, booting it on a queue turn, and waits until one is. Gives the
 * turn back while it waits, so waiting runs don't hold every slot.
 */
export async function leaseSimulator({
  describeWait,
  getCandidates,
  isTestRun,
  isWaiting = false,
}: {
  describeWait: (booted: Simulator[]) => string;
  getCandidates: () => Simulator[];
  isTestRun: boolean;
  isWaiting?: boolean;
}): Promise<{ lease: Lease; turn: QueueTurn | undefined }> {
  const turn = await waitForTurn();
  const attempt = chooseSimulator({ getCandidates, isTestRun });

  if ("descriptor" in attempt) {
    return { lease: attempt, turn };
  }

  turn?.release();

  if (!isWaiting) {
    process.stderr.write(describeWait(attempt.booted));
  }

  await sleep(POLL_MS);
  return leaseSimulator({ describeWait, getCandidates, isTestRun, isWaiting: true });
}
