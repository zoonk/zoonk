import { availableParallelism, loadavg } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

// Simulators and emulators miss their deadlines and crash once the Mac runs much more work than it
// has cores.

const CHECK_INTERVAL_MS = 15_000;
const MAX_LOAD = availableParallelism() * 2;

function getLoad() {
  return loadavg()[0] ?? 0;
}

if (getLoad() > MAX_LOAD) {
  process.stdout.write(
    `Waiting for the Mac's load (${getLoad().toFixed(0)}) to fall below ${MAX_LOAD}...\n`,
  );
}

while (getLoad() > MAX_LOAD) {
  // oxlint-disable-next-line no-await-in-loop -- polls until the load falls
  await sleep(CHECK_INTERVAL_MS);
}
