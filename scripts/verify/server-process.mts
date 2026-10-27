import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { getPortlessEnvironment } from "../dev/config.mts";
import { getPnpmCommand } from "../dev/process.mts";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
/** Linux's clock ticks per second (`getconf CLK_TCK`), 100 on every common kernel. */
const TICKS_PER_SECOND = 100;
/** `/proc/<pid>/stat` fields 14 and 15 (user and system ticks), counted after the process name. */
const USER_TICKS = 11;
const SYSTEM_TICKS = 12;

/** `ps -o time=` output (`1:02.34` on macOS, `01:02:03` on Linux) in milliseconds. */
export function parseCpuTime(text: string): number {
  const seconds = text
    .trim()
    .split(":")
    .reduce((total, part) => total * SECONDS_PER_MINUTE + Number(part), 0);

  return Math.round(seconds * MS_PER_SECOND);
}

function read(command: string, args: string[], environment = process.env): string {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      env: environment,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

/** The local port behind a `pnpm dev` or `pnpm start` route, from `portless list`'s "-> localhost:4242". */
function findPortlessPort(url: URL): string | undefined {
  const pnpm = getPnpmCommand(process.env);

  const routes = read(pnpm.command, [...pnpm.args, "exec", "portless", "list"], {
    ...process.env,
    ...getPortlessEnvironment({ homeDirectory: homedir(), lanMode: false }),
  });

  const route = routes.split("\n").find((line) => line.trim().startsWith(`${url.origin} `));
  return /->\s+localhost:(?<port>\d+)/u.exec(route ?? "")?.groups?.port;
}

function findPort(url: URL): string | undefined {
  if (["127.0.0.1", "localhost"].includes(url.hostname)) {
    return url.port;
  }

  return url.hostname.endsWith(".localhost") ? findPortlessPort(url) : undefined;
}

/**
 * The Next.js server answering a local URL (a Portless route or a localhost port), found by the
 * port it listens on, so a page load's server CPU can be measured. Null for any other URL.
 */
export function findServerPid(url: URL): number | null {
  const port = findPort(url);

  if (!port) {
    return null;
  }

  const pid = Number(read("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]).split("\n")[0]);

  return pid && read("ps", ["-o", "command=", "-p", String(pid)]).includes("next") ? pid : null;
}

const KB_PER_MB = 1024;

/** The process's resident memory now, in MB (`ps -o rss=` reports KB on macOS and Linux). */
export function readRssMb(pid: number): number | null {
  const kilobytes = Number(read("ps", ["-o", "rss=", "-p", String(pid)]).trim());
  return kilobytes > 0 ? kilobytes / KB_PER_MB : null;
}

/** The process's CPU time so far (user and system), in milliseconds. */
export function readCpuMs(pid: number): number | null {
  try {
    const fields = readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1]?.split(" ") ?? [];
    const ticks = Number(fields[USER_TICKS]) + Number(fields[SYSTEM_TICKS]);
    return Math.round((ticks / TICKS_PER_SECOND) * MS_PER_SECOND);
  } catch {
    const time = read("ps", ["-o", "time=", "-p", String(pid)]);
    return time ? parseCpuTime(time) : null;
  }
}
