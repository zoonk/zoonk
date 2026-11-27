import { spawnSync } from "node:child_process";
import path from "node:path";
import { isJsonObject } from "../../../packages/utils/src/json.ts";

export type DeviceFamily = "ipad" | "iphone";

export type Simulator = {
  deviceTypeIdentifier: string;
  isAvailable: boolean;
  name: string;
  state: string;
  udid: string;
};

type SimulatorCatalog = { devices: Record<string, Simulator[]> };

export const TEMPORARY_TEST_SIMULATOR_NAME = "Zoonk Lease Test";

const DEVICE_TYPE_PREFIXES = {
  ipad: "com.apple.CoreSimulator.SimDeviceType.iPad-",
  iphone: "com.apple.CoreSimulator.SimDeviceType.iPhone-",
} satisfies Record<DeviceFamily, string>;

const PREFERRED_DEVICE_TYPES = {
  ipad: "com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M5-12GB",
  iphone: "com.apple.CoreSimulator.SimDeviceType.iPhone-17",
} satisfies Record<DeviceFamily, string>;

export const appleDirectory = path.resolve(import.meta.dirname, "..");

export function runCommand({
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

export function readCommand({
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

function isSimulator(value: unknown): value is Simulator {
  if (!isJsonObject(value)) {
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
  if (!isJsonObject(value) || !isJsonObject(value.devices)) {
    return false;
  }

  return Object.values(value.devices).every(
    (devices) => Array.isArray(devices) && devices.every((device) => isSimulator(device)),
  );
}

export function listSimulators(): SimulatorCatalog {
  const catalog: unknown = JSON.parse(
    readCommand({
      arguments: ["simctl", "list", "devices", "available", "--json"],
      command: "xcrun",
    }),
  );

  if (!isSimulatorCatalog(catalog)) {
    throw new Error("CoreSimulator returned an unexpected device list.");
  }

  return catalog;
}

function isDeviceType(value: unknown): value is { identifier: string; name: string } {
  return (
    isJsonObject(value) && typeof value.identifier === "string" && typeof value.name === "string"
  );
}

/** Xcode names its simulators after their model; other tools, like simlock, name theirs. */
function listModelNames(): Map<string, string> {
  const list: unknown = JSON.parse(
    readCommand({ arguments: ["simctl", "list", "devicetypes", "--json"], command: "xcrun" }),
  );

  if (
    !isJsonObject(list) ||
    !Array.isArray(list.devicetypes) ||
    !list.devicetypes.every((deviceType) => isDeviceType(deviceType))
  ) {
    throw new Error("CoreSimulator returned an unexpected device type list.");
  }

  return new Map(list.devicetypes.map(({ identifier, name }) => [identifier, name]));
}

function compareRuntimeEntries(
  [leftIdentifier]: [string, Simulator[]],
  [rightIdentifier]: [string, Simulator[]],
) {
  return rightIdentifier.localeCompare(leftIdentifier, undefined, { numeric: true });
}

function isFamilySimulator({
  device,
  family,
  modelNames,
}: {
  device: Simulator;
  family: DeviceFamily;
  modelNames: Map<string, string>;
}) {
  return (
    device.isAvailable &&
    device.deviceTypeIdentifier.startsWith(DEVICE_TYPE_PREFIXES[family]) &&
    device.name === modelNames.get(device.deviceTypeIdentifier)
  );
}

function isPreferredSimulator({ device, family }: { device: Simulator; family: DeviceFamily }) {
  return device.deviceTypeIdentifier === PREFERRED_DEVICE_TYPES[family];
}

/**
 * Xcode's own simulators of the family on the newest runtime that has the preferred model,
 * preferred first. A runtime made for one new device, like the iPhone Duo's, sorts above the
 * general one, so the newest runtime alone can hold only that device.
 */
export function getNewestSimulators({
  catalog,
  family,
}: {
  catalog: SimulatorCatalog;
  family: DeviceFamily;
}): { devices: Simulator[]; runtimeIdentifier: string } {
  const modelNames = listModelNames();

  const runtimes = Object.entries(catalog.devices)
    .filter(([runtimeIdentifier]) => runtimeIdentifier.includes(".SimRuntime.iOS-"))
    .toSorted(compareRuntimeEntries)
    .map(([runtimeIdentifier, devices]) => ({
      devices: devices
        .filter((device) => isFamilySimulator({ device, family, modelNames }))
        .toSorted(
          (left, right) =>
            Number(isPreferredSimulator({ device: right, family })) -
            Number(isPreferredSimulator({ device: left, family })),
        ),
      runtimeIdentifier,
    }));

  const runtime =
    runtimes.find(({ devices }) =>
      devices.some((device) => isPreferredSimulator({ device, family })),
    ) ?? runtimes.find(({ devices }) => devices.length > 0);

  if (!runtime) {
    throw new Error(`No available ${family} simulator is installed.`);
  }

  return runtime;
}

export function getTestSimulators() {
  const catalog = listSimulators();
  const { devices, runtimeIdentifier } = getNewestSimulators({ catalog, family: "iphone" });

  const temporary = (catalog.devices[runtimeIdentifier] ?? []).filter(
    (device) => device.name === TEMPORARY_TEST_SIMULATOR_NAME,
  );

  return {
    create() {
      const deviceTypeIdentifier =
        devices[0]?.deviceTypeIdentifier ?? PREFERRED_DEVICE_TYPES.iphone;

      const udid = readCommand({
        arguments: [
          "simctl",
          "create",
          TEMPORARY_TEST_SIMULATOR_NAME,
          deviceTypeIdentifier,
          runtimeIdentifier,
        ],
        command: "xcrun",
      });

      return {
        deviceTypeIdentifier,
        isAvailable: true,
        name: TEMPORARY_TEST_SIMULATOR_NAME,
        state: "Shutdown",
        udid,
      };
    },
    devices: [...temporary, ...devices.toReversed()],
  };
}

export function getTestDestination(destination: string) {
  const match = /^(?:platform=iOS Simulator,)?id=(?<id>[\da-f-]+)$/iu.exec(destination);
  const id = match?.groups?.id?.toUpperCase();

  const device = Object.values(listSimulators().devices)
    .flat()
    .find(({ udid }) => udid === id);

  if (!device) {
    throw new Error(
      "Select an available simulator with TEST_DESTINATION='platform=iOS Simulator,id=<udid>'.",
    );
  }

  return { devices: [device] };
}
