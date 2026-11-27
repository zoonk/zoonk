import { spawnSync } from "node:child_process";
import path from "node:path";
import { findSimulatorAppCrashes } from "../../../scripts/dev/crash-reports.mts";
import { applyCommandExit, runForegroundCommand } from "../../../scripts/dev/process.mts";
import { assertDeviceUnclaimed, deviceClaims } from "./device-claims.mts";
import { type Lease, leaseSimulator, releaseLease } from "./leases.mts";
import {
  type Simulator,
  getNewestSimulators,
  getTestDestination,
  getTestSimulators,
  listSimulators,
} from "./simulators.mts";
import { swiftPackagesArguments } from "./swift-packages.mts";

const CLOSE_CRASH_ALERTS_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../scripts/dev/close-device-crash-alerts.mts",
);

const MAX_HOLD_SECONDS = 2_147_483;

function getNewestIphones() {
  return getNewestSimulators({ catalog: listSimulators(), family: "iphone" }).devices;
}

function listNames(simulators: Simulator[]) {
  return simulators.map(({ name }) => name).join(", ");
}

function cleanUpAfterAppCrashes({ device, reportsBefore }: Lease) {
  const crashes = findSimulatorAppCrashes({ reportsBefore, udid: device.udid });

  // Damaged simulator data can crash one of its iOS apps on every boot, each crash opening an alert.
  if (crashes.some(({ isSystemApp }) => isSystemApp)) {
    process.stdout.write(
      `One of iOS's own apps crashed on ${device.name}. Erasing it so the crash doesn't repeat on ` +
        `its next boot.\n`,
    );

    spawnSync("xcrun", ["simctl", "erase", device.udid], { stdio: "inherit" });
  }

  if (crashes.length > 0) {
    spawnSync(process.execPath, [CLOSE_CRASH_ALERTS_SCRIPT], { stdio: "inherit" });
  }
}

async function test({
  args,
  command,
  destination,
}: {
  args: string[];
  command: string;
  destination?: string;
}) {
  if (args.some((arg) => arg === "-destination" || arg.startsWith("-destination="))) {
    throw new Error("Use TEST_DESTINATION to select a simulator through the lease.");
  }

  const { lease, turn } = await leaseSimulator({
    automatic: destination === undefined,
    getCandidates: destination ? () => getTestDestination(destination) : getTestSimulators,
    kind: "test",
    label: destination ?? "an iPhone test simulator",
  });

  process.stdout.write(`Testing on ${lease.device.name} (${lease.device.udid}).\n`);

  try {
    const packages = process.env.CI ? [] : swiftPackagesArguments();
    assertDeviceUnclaimed(lease.device.udid);

    applyCommandExit(
      await runForegroundCommand({
        args: [...args, ...packages, "-destination", `id=${lease.device.udid}`],
        command,
        currentDirectory: process.cwd(),
        environment: { ...process.env, ...turn?.environment },
        // xcodebuild holds the lease too, so it stays taken while tests run even if this script dies.
        stdio: ["inherit", "inherit", "inherit", lease.descriptor],
      }),
    );
  } finally {
    try {
      if (lease.shutDownAfter && !deviceClaims().has(lease.device.udid)) {
        spawnSync("xcrun", ["simctl", "shutdown", lease.device.udid], { stdio: "inherit" });

        if (lease.temporary) {
          spawnSync("xcrun", ["simctl", "delete", lease.device.udid], { stdio: "inherit" });
        } else {
          cleanUpAfterAppCrashes(lease);
        }
      }
    } finally {
      releaseLease(lease);
      turn?.release();
    }
  }
}

function getNamedIphone(named: string) {
  const iphones = getNewestIphones();
  const matches = iphones.filter(({ name, udid }) => named === name || named === udid);

  if (matches.length === 0) {
    throw new Error(`${named} isn't one of Xcode's own iPhone simulators: ${listNames(iphones)}.`);
  }

  return matches;
}

/** For a simulator someone drives by hand, such as in a walk. It stays booted once released. */
async function hold(named: string) {
  const seconds = Number(process.env.ZOONK_SIMULATOR_HOLD_SECONDS ?? 3600);

  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_HOLD_SECONDS) {
    throw new Error("ZOONK_SIMULATOR_HOLD_SECONDS must be between 0 and 2147483 seconds.");
  }

  const { lease, turn } = await leaseSimulator({
    getCandidates: () => ({ devices: getNamedIphone(named) }),
    kind: "hold",
    label: named,
  });

  turn?.release();

  process.stdout.write(
    `Holding ${lease.device.name} (${lease.device.udid}) for up to ${seconds}s.\n`,
  );

  try {
    await new Promise<void>((resolve) => {
      const signals = ["SIGHUP", "SIGINT", "SIGTERM"] as const;

      const timer = setTimeout(() => {
        process.stderr.write(`Hold on ${lease.device.name} expired after ${seconds}s.\n`);
        finish();
      }, seconds * 1000);

      function finish() {
        clearTimeout(timer);

        for (const signal of signals) {
          process.off(signal, finish);
        }

        resolve();
      }

      for (const signal of signals) {
        process.once(signal, finish);
      }
    });
  } finally {
    releaseLease(lease);
  }
}

const args = process.argv.slice(2);
const destination = args[0] === "--destination" ? args.splice(0, 2)[1] : undefined;
const [command, ...commandArguments] = args;

if (command === "--hold" && commandArguments[0]) {
  await hold(commandArguments[0]);
} else if (command && command !== "--hold") {
  await test({ args: commandArguments, command, ...(destination ? { destination } : {}) });
} else {
  throw new Error(
    "Usage: with-simulator.mts <xcodebuild command> | --hold <simulator name or udid>",
  );
}
