import { spawnSync } from "node:child_process";
import path from "node:path";

type DeviceFamily = "ipad" | "iphone";

type Simulator = {
  deviceTypeIdentifier: string;
  isAvailable: boolean;
  name: string;
  state: string;
  udid: string;
};

type SimulatorCatalog = { devices: Record<string, Simulator[]> };

type SimulatorDestination = { device: Simulator; runtimeIdentifier: string };

const APP_SCHEME = "Zoonk";

const DEVICE_TYPE_PREFIXES = {
  ipad: "com.apple.CoreSimulator.SimDeviceType.iPad-",
  iphone: "com.apple.CoreSimulator.SimDeviceType.iPhone-",
} satisfies Record<DeviceFamily, string>;

const PREFERRED_DEVICE_TYPES = {
  ipad: "com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M5-12GB",
  iphone: "com.apple.CoreSimulator.SimDeviceType.iPhone-17",
} satisfies Record<DeviceFamily, string>;

const appleDirectory = path.resolve(import.meta.dirname, "..");
const derivedDataPath = path.join(appleDirectory, "DerivedData", "Simulator");
const projectPath = path.join(appleDirectory, `${APP_SCHEME}.xcodeproj`);

function runCommand({
  arguments: commandArguments,
  command,
}: {
  arguments: string[];
  command: string;
}) {
  const result = spawnSync(command, commandArguments, { cwd: appleDirectory, stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 1}.`);
  }
}

function readCommand({
  arguments: commandArguments,
  command,
}: {
  arguments: string[];
  command: string;
}) {
  const result = spawnSync(command, commandArguments, { cwd: appleDirectory, encoding: "utf8" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`${command} exited with status ${result.status ?? 1}.`);
  }

  return result.stdout.trim();
}

function getDeviceFamily(value: string | undefined): DeviceFamily {
  if (value === "iphone" || value === "ipad") {
    return value;
  }

  throw new Error("Usage: run-simulator.mts <iphone|ipad>");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSimulator(value: unknown): value is Simulator {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.deviceTypeIdentifier === "string" &&
    typeof value.isAvailable === "boolean" &&
    typeof value.name === "string" &&
    typeof value.state === "string" &&
    typeof value.udid === "string"
  );
}

function isSimulatorCatalog(value: unknown): value is SimulatorCatalog {
  if (!isRecord(value) || !isRecord(value.devices)) {
    return false;
  }

  return Object.values(value.devices).every(
    (devices) => Array.isArray(devices) && devices.every((device) => isSimulator(device)),
  );
}

function parseSimulatorCatalog(value: string): SimulatorCatalog {
  const catalog: unknown = JSON.parse(value);

  if (!isSimulatorCatalog(catalog)) {
    throw new Error("CoreSimulator returned an unexpected device list.");
  }

  return catalog;
}

function compareRuntimeEntries(
  [leftIdentifier]: [string, Simulator[]],
  [rightIdentifier]: [string, Simulator[]],
) {
  return rightIdentifier.localeCompare(leftIdentifier, undefined, { numeric: true });
}

function isFamilySimulator({ device, family }: { device: Simulator; family: DeviceFamily }) {
  return device.isAvailable && device.deviceTypeIdentifier.startsWith(DEVICE_TYPE_PREFIXES[family]);
}

function getSimulatorDestination({
  catalog,
  family,
}: {
  catalog: SimulatorCatalog;
  family: DeviceFamily;
}): SimulatorDestination {
  const runtimeEntries = Object.entries(catalog.devices)
    .filter(([runtimeIdentifier]) => runtimeIdentifier.includes(".SimRuntime.iOS-"))
    .toSorted(compareRuntimeEntries);

  const runtimeEntry = runtimeEntries.find(([, devices]) =>
    devices.some((device) => isFamilySimulator({ device, family })),
  );

  if (!runtimeEntry) {
    throw new Error(`No available ${family} simulator is installed.`);
  }

  const [runtimeIdentifier, devices] = runtimeEntry;
  const familyDevices = devices.filter((device) => isFamilySimulator({ device, family }));

  const preferredDevice = familyDevices.find(
    (device) => device.deviceTypeIdentifier === PREFERRED_DEVICE_TYPES[family],
  );

  const device = preferredDevice ?? familyDevices[0];

  if (!device) {
    throw new Error(`No available ${family} simulator is installed.`);
  }

  return { device, runtimeIdentifier };
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
      "CODE_SIGNING_ALLOWED=NO",
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

function installAndLaunchApp({ appPath, device }: { appPath: string; device: Simulator }) {
  const bundleIdentifier = getBundleIdentifier(appPath);

  runCommand({ arguments: ["simctl", "install", device.udid, appPath], command: "xcrun" });

  runCommand({
    arguments: ["-a", "Simulator", "--args", "-CurrentDeviceUDID", device.udid],
    command: "open",
  });

  runCommand({
    arguments: ["simctl", "launch", "--terminate-running-process", device.udid, bundleIdentifier],
    command: "xcrun",
  });
}

function runSimulator(family: DeviceFamily) {
  const catalog = parseSimulatorCatalog(
    readCommand({
      arguments: ["simctl", "list", "devices", "available", "--json"],
      command: "xcrun",
    }),
  );

  const { device, runtimeIdentifier } = getSimulatorDestination({ catalog, family });

  process.stdout.write(
    `Building ${APP_SCHEME} for ${device.name} (${getRuntimeName(runtimeIdentifier)})...\n`,
  );

  bootSimulator(device);
  buildApp(device);
  installAndLaunchApp({ appPath: getAppPath(), device });
  process.stdout.write(`${APP_SCHEME} is running on ${device.name}.\n`);
}

try {
  runSimulator(getDeviceFamily(process.argv[2]));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
