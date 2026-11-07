import { env, kill, pid, stderr, stdout } from "node:process";

/**
 * Portless starts each service in its own process group, so neither a force-killed `pnpm dev` nor a
 * task Turbo force-kills takes the service with it, and Next.js retries writing to the closed pipe
 * until it holds a CPU core (https://github.com/vercel/next.js/issues/96216).
 */
const LAUNCHER_CHECK_INTERVAL_MS = 2000;
const launcherPids = String(env.ZOONK_DEV_LAUNCHER_PIDS).split(",").map(Number);

function isRunning(launcherPid: number): boolean {
  try {
    kill(launcherPid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Stops this process the way Turbo or Ctrl-C would, so Next.js and Vite shut down as usual. */
function stop(): void {
  kill(pid, "SIGTERM");
}

function stopWithoutLaunchers(): void {
  if (!launcherPids.every((launcherPid) => isRunning(launcherPid))) {
    stop();
  }
}

setInterval(stopWithoutLaunchers, LAUNCHER_CHECK_INTERVAL_MS).unref();
stdout.on("error", stop);
stderr.on("error", stop);
