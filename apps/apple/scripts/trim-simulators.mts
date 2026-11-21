import { closeSync, lstatSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { getBootedSimulators, tryLocking } from "./leases.mts";
import { listSimulators } from "./simulators.mts";

// iOS's wallpaper service adds snapshots to this store on every boot and never removes them, until
// it outgrows everything else on the simulator. It rebuilds the wallpaper on the next boot.
const POSTER_STORE = path.join(
  "data",
  "Library",
  "Application Support",
  "PRBPosterExtensionDataStore",
);

const POSTER_STORE_LIMIT_BYTES = 1024 ** 3;

function sizeOf(target: string): number {
  const stats = lstatSync(target, { throwIfNoEntry: false });

  if (!stats?.isDirectory()) {
    return stats?.size ?? 0;
  }

  return readdirSync(target).reduce((total, name) => total + sizeOf(path.join(target, name)), 0);
}

function isBooted(udid: string): boolean {
  return getBootedSimulators().some((device) => device.udid === udid);
}

/** Removes the oversized wallpaper store of each shut-down simulator nobody holds, keeping its apps. */
export function trimSimulators(remove: (target: string) => void): void {
  const devices = Object.values(listSimulators().devices).flat();
  const simulatorsDirectory = path.join(homedir(), "Library", "Developer", "CoreSimulator");

  const storeOf = (udid: string) => path.join(simulatorsDirectory, "Devices", udid, POSTER_STORE);

  const oversized = devices.filter(
    (device) =>
      device.state === "Shutdown" && sizeOf(storeOf(device.udid)) > POSTER_STORE_LIMIT_BYTES,
  );

  for (const device of oversized) {
    const lock = tryLocking(device);

    // Someone may have booted it by hand since the list was read; a hand boot takes no lock.
    if (lock !== undefined) {
      if (!isBooted(device.udid)) {
        remove(storeOf(device.udid));
      }

      closeSync(lock);
    }
  }
}
