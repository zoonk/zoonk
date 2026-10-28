import { env, kill, pid, stderr, stdout } from "node:process";

/**
 * Portless starts each service in its own process group, so a force-killed `pnpm dev` leaves it
 * running, and Next.js retries writing to the closed pipe until it holds a CPU core
 * (https://github.com/vercel/next.js/issues/96216).
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
