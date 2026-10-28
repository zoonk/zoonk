import { env, kill, pid, stderr, stdout } from "node:process";

/**
 * `run-service.mts` loads this into every process of a development service through `NODE_OPTIONS`.
 * Portless starts each service in its own process group, so when an agent or terminal force-kills
 * `pnpm dev`, the service keeps running with nobody reading its output. Next.js then logs each
 * failed write to that closed pipe, which fails again, so the orphan holds a CPU core and grows its
 * memory until someone kills it (https://github.com/vercel/next.js/issues/96216). Stopping with the
 * launcher or with the output prevents both.
 */
const LAUNCHER_CHECK_INTERVAL_MS = 2000;
const launcherPid = Number(env.ZOONK_DEV_LAUNCHER_PID);

function isLauncherRunning(): boolean {
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

function stopWithoutLauncher(): void {
  if (!isLauncherRunning()) {
    stop();
  }
}

setInterval(stopWithoutLauncher, LAUNCHER_CHECK_INTERVAL_MS).unref();
stdout.on("error", stop);
stderr.on("error", stop);
