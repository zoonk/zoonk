import { randomUUID } from "node:crypto";
import { closeSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { openExclusiveLock, tryExclusiveLock } from "../../../scripts/dev/exclusive-lock.mts";

export function joinWaitLine(directory: string) {
  const name = `${Date.now()}-${randomUUID()}`;
  const ticket = path.join(directory, name);
  const descriptor = openExclusiveLock({ lockPath: ticket });

  return {
    isFirst() {
      for (const earlier of readdirSync(directory)
        .filter((entry) => entry < name)
        .toSorted()) {
        const previous = path.join(directory, earlier);
        const held = tryExclusiveLock(previous);

        if (held === undefined) {
          return false;
        }

        rmSync(previous, { force: true });
        closeSync(held);
      }

      return true;
    },
    leave() {
      rmSync(ticket, { force: true });
      closeSync(descriptor);
    },
  };
}
