import { spawnSync } from "node:child_process";
import { closeSync, ftruncateSync, readFileSync, writeSync } from "node:fs";
import { availableParallelism, homedir, loadavg } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { listCrashReports } from "../../../scripts/dev/crash-reports.mts";
import { openExclusiveLock, tryExclusiveLock } from "../../../scripts/dev/exclusive-lock.mts";
import { type QueueTurn, waitForTurn } from "../../../scripts/dev/queue.mts";
import { deviceClaims } from "./device-claims.mts";
import { joinWaitLine } from "./simulator-wait-line.mts";
import { type Simulator, TEMPORARY_TEST_SIMULATOR_NAME, listSimulators } from "./simulators.mts";

const BUSY_MAX_BOOTED_SIMULATORS = 3;
const QUIET_MAX_BOOTED_SIMULATORS = 6;
const POLL_MS = 5000;
const REPORT_INTERVAL_MS = 30_000;
const DEFAULT_WAIT_SECONDS = 600;

const leaseDirectory = path.join(homedir(), ".cache", "zoonk", "simulators");

type LeaseKind = "test" | "hold" | "launch";
type Candidates = { devices: Simulator[]; create?: () => Simulator };

type LeaseOptions = {
  getCandidates: () => Candidates;
  kind: LeaseKind;
  label: string;
  automatic?: boolean;
};

type Reservation = {
  descriptor: number;
  device: Simulator;
  temporary: boolean;
  wasBooted: boolean;
};

export type Lease = Reservation & { reportsBefore: Set<string>; shutDownAfter: boolean };

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

function leaseFile(udid: string) {
  return path.join(leaseDirectory, udid);
}

export function tryLocking({ udid }: Pick<Simulator, "udid">): number | undefined {
  return tryExclusiveLock(leaseFile(udid));
}

export function releaseLease({ descriptor }: { descriptor: number }) {
  ftruncateSync(descriptor);
  closeSync(descriptor);
}

function markLease({ descriptor, kind }: { descriptor: number; kind: LeaseKind | "pinned test" }) {
  ftruncateSync(descriptor);

  writeSync(
    descriptor,
    `${kind} / PID ${process.pid} / ${process.cwd()} / since ${new Date().toISOString()}`,
    0,
  );
}

function isAbandonedTest(udid: string) {
  const mark = readFileSync(leaseFile(udid), "utf8");
  return mark.startsWith("test /") || /^\d+$/u.test(mark);
}

function boot(device: Simulator) {
  const result = spawnSync("xcrun", ["simctl", "boot", device.udid], { encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(
      `Couldn't boot ${device.name}: ${result.error?.message ?? result.stderr.trim()}`,
    );
  }
}

function underChoosingLock<T>(action: () => T): T {
  const descriptor = openExclusiveLock({ lockPath: path.join(leaseDirectory, "choosing") });

  try {
    return action();
  } finally {
    closeSync(descriptor);
  }
}

function waitDetails({
  booted,
  devices,
  claims,
}: {
  booted: Simulator[];
  devices: Simulator[];
  claims: Map<string, string>;
}) {
  const relevant = new Map([...booted, ...devices].map((device) => [device.udid, device]));

  const owners = [...relevant.values()].flatMap((device) => {
    const claim = claims.get(device.udid);
    const descriptor = tryLocking(device);

    if (descriptor !== undefined) {
      closeSync(descriptor);
    }

    const owner = descriptor === undefined ? readFileSync(leaseFile(device.udid), "utf8") : "";

    const description = [owner || (descriptor === undefined ? "Zoonk lease" : ""), claim]
      .filter(Boolean)
      .join("; ");

    if (description) {
      return `${device.name} (${device.udid}): ${description}`;
    }

    return booted.some(({ udid }) => udid === device.udid)
      ? `${device.name} (${device.udid}): booted without a lease`
      : [];
  });

  return `${booted.length}/${getMaxBootedSimulators()} simulators booted${owners.length > 0 ? `\n  ${owners.join("\n  ")}` : ""}.`;
}

function reserveDevice({
  automatic,
  canBoot,
  device,
  kind,
  wasBooted,
}: {
  automatic: boolean;
  canBoot: boolean;
  device: Simulator;
  kind: LeaseKind;
  wasBooted: boolean;
}): Reservation | "boot-limit" | undefined {
  const descriptor = tryLocking(device);

  if (descriptor === undefined) {
    return;
  }

  if (wasBooted ? automatic && !isAbandonedTest(device.udid) : !canBoot) {
    closeSync(descriptor);
    return wasBooted ? undefined : "boot-limit";
  }

  markLease({ descriptor, kind: kind === "test" && !automatic ? "pinned test" : kind });

  return {
    descriptor,
    device,
    temporary: device.name === TEMPORARY_TEST_SIMULATOR_NAME,
    wasBooted,
  };
}

function reserve({
  automatic = false,
  firstInLine,
  getCandidates,
  kind,
}: LeaseOptions & { firstInLine: boolean }): Reservation | { details: string } {
  if (!firstInLine) {
    return { details: "Earlier automatic tests are waiting for a simulator." };
  }

  return underChoosingLock(() => {
    const { devices, create } = getCandidates();
    const booted = getBootedSimulators();
    const claims = deviceClaims();
    const bootLimit = getMaxBootedSimulators();
    const canBoot = booted.length < bootLimit;

    for (const device of devices.filter(({ udid }) => !claims.has(udid))) {
      const reservation = reserveDevice({
        automatic,
        canBoot,
        device,
        kind,
        wasBooted: booted.some(({ udid }) => udid === device.udid),
      });

      if (reservation === "boot-limit" && kind === "launch") {
        break;
      }

      if (reservation && reservation !== "boot-limit") {
        return reservation;
      }
    }

    const occupiedSlots = new Set(
      [...booted, ...devices.filter(({ name }) => name === TEMPORARY_TEST_SIMULATOR_NAME)].map(
        ({ udid }) => udid,
      ),
    );

    if (create && occupiedSlots.size < bootLimit) {
      const reservation = reserveDevice({
        automatic,
        canBoot,
        device: create(),
        kind,
        wasBooted: false,
      });

      if (reservation && reservation !== "boot-limit") {
        return reservation;
      }
    }

    return { details: waitDetails({ booted, claims, devices }) };
  });
}

function startLease(reservation: Reservation, options: LeaseOptions): Lease | undefined {
  return underChoosingLock(() => {
    const { device } = reservation;
    const booted = getBootedSimulators();
    const isBooted = booted.some(({ udid }) => udid === device.udid);

    if (
      deviceClaims().has(device.udid) ||
      (isBooted && !reservation.wasBooted && options.automatic) ||
      (!isBooted && booted.length >= getMaxBootedSimulators())
    ) {
      return;
    }

    const reportsBefore = new Set(listCrashReports());

    if (!isBooted) {
      if (options.kind === "test" && !options.automatic) {
        markLease({ descriptor: reservation.descriptor, kind: "test" });
      }

      boot(device);
    }

    return {
      ...reservation,
      reportsBefore,
      shutDownAfter: options.kind === "test" && (Boolean(options.automatic) || !isBooted),
    };
  });
}

function discardReservation(reservation: Reservation) {
  try {
    if (
      reservation.temporary &&
      !getBootedSimulators().some(({ udid }) => udid === reservation.device.udid) &&
      !deviceClaims().has(reservation.device.udid)
    ) {
      spawnSync("xcrun", ["simctl", "delete", reservation.device.udid], { stdio: "inherit" });
    }
  } finally {
    releaseLease(reservation);
  }
}

async function startQueuedLease(reservation: Reservation, options: LeaseOptions) {
  let turn: QueueTurn | undefined;
  let lease: Lease | undefined;

  try {
    // A waiter that cannot reserve a simulator never joins the heavy build queue.
    turn = await waitForTurn();
    lease = startLease(reservation, options);

    if (lease) {
      return { lease, turn };
    }
  } finally {
    if (!lease) {
      turn?.release();
      discardReservation(reservation);
    }
  }
}

export async function leaseSimulator(
  options: LeaseOptions,
): Promise<{ lease: Lease; turn: QueueTurn | undefined }> {
  const timeout = Number(process.env.ZOONK_SIMULATOR_WAIT_SECONDS ?? DEFAULT_WAIT_SECONDS);

  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Error("ZOONK_SIMULATOR_WAIT_SECONDS must be a positive number.");
  }

  const waitLine = path.join(leaseDirectory, "test-waiters");
  let waiting = options.automatic ? joinWaitLine(waitLine) : undefined;
  let started = performance.now();
  let reportedAt = -Infinity;

  try {
    for (;;) {
      const attempt = reserve({ ...options, firstInLine: waiting?.isFirst() ?? true });

      if ("descriptor" in attempt) {
        waiting?.leave();
        waiting = undefined;
        const queuedAt = performance.now();

        // oxlint-disable-next-line no-await-in-loop -- get a build slot for this reservation
        const startedLease = await startQueuedLease(attempt, options);

        if (startedLease) {
          return startedLease;
        }

        started += performance.now() - queuedAt;
        waiting = options.automatic ? joinWaitLine(waitLine) : undefined;
      }

      const now = performance.now();
      const elapsed = now - started;

      const details =
        "details" in attempt ? attempt.details : "Simulator availability changed before boot.";

      if (elapsed >= timeout * 1000) {
        throw new Error(`Timed out after ${timeout}s waiting for ${options.label}. ${details}`);
      }

      if (now - reportedAt >= REPORT_INTERVAL_MS) {
        process.stderr.write(
          `Waiting for ${options.label} (${Math.floor(elapsed / 1000)}s). ${details}\n`,
        );

        reportedAt = now;
      }

      // oxlint-disable-next-line no-await-in-loop -- retry admission when a simulator becomes free
      await sleep(Math.min(POLL_MS, timeout * 1000 - elapsed));
    }
  } finally {
    waiting?.leave();
  }
}
