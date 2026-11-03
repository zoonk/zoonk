import { spawnSync } from "node:child_process";
import path from "node:path";
import { waitForTurn } from "../../../scripts/dev/queue.mts";
import {
  type DeviceFamily,
  type Simulator,
  appleDirectory,
  getNewestSimulators,
  isLeased,
  listSimulators,
  readCommand,
  runCommand,
} from "./simulators.mts";

const APP_SCHEME = "Zoonk";

const SIMULATOR_APP_BUNDLE_IDENTIFIERS = ["com.apple.iphonesimulator", "com.apple.dt.Devices"];

const derivedDataPath = path.join(appleDirectory, "DerivedData", "Simulator");
const projectPath = path.join(appleDirectory, `${APP_SCHEME}.xcodeproj`);

function getDeviceFamily(value: string | undefined): DeviceFamily {
  if (value === "iphone" || value === "ipad") {
    return value;
  }

  throw new Error("Usage: run-simulator.mts <iphone|ipad>");
}

function getRuntimeName(runtimeIdentifier: string) {
  return runtimeIdentifier.split(".SimRuntime.").at(-1)?.replaceAll("-", " ") ?? runtimeIdentifier;
}

function bootSimulator(device: Simulator) {
  if (device.state === "Shutdown") {
    runCommand({ arguments: ["simctl", "boot", device.udid], command: "xcrun" });
  }

  runCommand({ arguments: ["simctl", "bootstatus", device.udid, "-b"], command: "xcrun" });
}

/** Signed so it carries its entitlements: an unsigned build can't use the Keychain to save sign-in. */
function buildApp(device: Simulator) {
  runCommand({
    arguments: [
      "-quiet",
      "-skipPackagePluginValidation",
      "-project",
      projectPath,
      "-scheme",
      APP_SCHEME,
      "-configuration",
      "Debug",
      "-destination",
      `id=${device.udid}`,
      "-derivedDataPath",
      derivedDataPath,
      "build",
    ],
    command: "xcodebuild",
  });
}

function getAppPath() {
  return path.join(
    derivedDataPath,
    "Build",
    "Products",
    "Debug-iphonesimulator",
    `${APP_SCHEME}.app`,
  );
}

function getBundleIdentifier(appPath: string) {
  return readCommand({
    arguments: [
      "-extract",
      "CFBundleIdentifier",
      "raw",
      "-o",
      "-",
      path.join(appPath, "Info.plist"),
    ],
    command: "plutil",
  });
}

/** Xcode 27 replaced the Simulator app with DeviceHub. */
function showSimulator(device: Simulator) {
  const isOpen = SIMULATOR_APP_BUNDLE_IDENTIFIERS.some(
    (bundleIdentifier) =>
      spawnSync("open", ["-b", bundleIdentifier, "--args", "-CurrentDeviceUDID", device.udid], {
        stdio: "ignore",
      }).status === 0,
  );

  if (!isOpen) {
    throw new Error("Neither Simulator nor DeviceHub could be opened.");
  }
}

function installAndLaunchApp({ appPath, device }: { appPath: string; device: Simulator }) {
  const bundleIdentifier = getBundleIdentifier(appPath);

  runCommand({ arguments: ["simctl", "install", device.udid, appPath], command: "xcrun" });

  showSimulator(device);

  runCommand({
    arguments: ["simctl", "launch", "--terminate-running-process", device.udid, bundleIdentifier],
    command: "xcrun",
  });
}

async function runSimulator(family: DeviceFamily) {
  const { devices, runtimeIdentifier } = getNewestSimulators({ catalog: listSimulators(), family });
  const device = devices.find(({ udid }) => !isLeased(udid));

  if (!device) {
    throw new Error(`Every ${family} simulator is running tests. Try again when one finishes.`);
  }

  process.stdout.write(
    `Building ${APP_SCHEME} for ${device.name} (${getRuntimeName(runtimeIdentifier)})...\n`,
  );

  const turn = await waitForTurn();

  try {
    bootSimulator(device);
    buildApp(device);
  } finally {
    turn?.release();
  }

  installAndLaunchApp({ appPath: getAppPath(), device });
  process.stdout.write(`${APP_SCHEME} is running on ${device.name}.\n`);
}

try {
  await runSimulator(getDeviceFamily(process.argv[2]));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
