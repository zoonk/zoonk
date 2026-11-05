import { constants, mkdirSync, openSync } from "node:fs";
import path from "node:path";

// macOS's open(2) flag for an exclusive lock, which Node doesn't export. The kernel keeps the lock
// until every process holding the file closes it, however they exit.
const O_EXLOCK = 0x20;

/**
 * Waits until no other process holds the lock, or throws EAGAIN with `O_NONBLOCK` in `flags`. Lock
 * files stay in place: removing one lets a process lock it while another locks its replacement.
 */
export function openExclusiveLock({ flags = 0, lockPath }: { flags?: number; lockPath: string }) {
  mkdirSync(path.dirname(lockPath), { recursive: true });
  // oxlint-disable-next-line no-bitwise -- open(2) takes its flags as bits
  return openSync(lockPath, constants.O_RDWR | constants.O_CREAT | O_EXLOCK | flags);
}
