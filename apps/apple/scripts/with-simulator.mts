import { spawnSync } from "node:child_process";
import path from "node:path";
import { findSimulatorAppCrashes } from "../../../scripts/dev/crash-reports.mts";
import { applyCommandExit, runForegroundCommand } from "../../../scripts/dev/process.mts";
import { BOOT_LIMIT, type Lease, POLL_MS, leaseSimulator, releaseLease } from "./leases.mts";
import { type Simulator, getNewestSimulators, listSimulators } from "./simulators.mts";

const CLOSE_CRASH_ALERTS_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../scripts/dev/close-device-crash-alerts.mts",
);

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

async function test({ args, command }: { args: string[]; command: string }) {
  const { lease, turn } = await leaseSimulator({
    describeWait: (booted) =>
      `Waiting for a simulator. Each test run boots a shut-down iPhone of its own, with ` +
      `${BOOT_LIMIT}, and booted now: ${listNames(booted)}. Shut down one you're done with, or ` +
      `set TEST_DESTINATION='platform=iOS Simulator,id=<udid>' to test on yours.\n`,
    // iPhone 17 last: `pnpm iphone` and older checkouts' `make test` pick it by name.
    getCandidates: () => getNewestIphones().toReversed(),
    isTestRun: true,
  });

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
    cleanUpAfterAppCrashes(lease);
    releaseLease(lease);
    turn?.release();
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
  const { lease, turn } = await leaseSimulator({
    describeWait: (booted) =>
      `Waiting for ${named} while a test run or another hold has it, or until it can boot with ` +
      `${BOOT_LIMIT}. Booted now: ${listNames(booted)}.\n`,
    getCandidates: () => getNamedIphone(named),
    isTestRun: false,
  });

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
  releaseLease(lease);
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
