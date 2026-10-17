import { type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const STOP_GRACE_MS = 10_000;

/**
 * `next start` answers SIGTERM by waiting for in-flight requests, and the local Workflow queue keeps
 * retrying deliveries to it, so a test API can outlive its caller for minutes. Only `next start`
 * children belong here: `next dev` forks a server that a SIGKILL of its parent would orphan.
 */
export async function stopChildProcess({
  child,
  exited,
  graceMs = STOP_GRACE_MS,
  name,
}: {
  child: ChildProcess;
  exited: Promise<unknown>;
  graceMs?: number;
  name: string;
}) {
  if (child.exitCode !== null || child.signalCode !== null) {
    await exited;
    return;
  }

  child.kill("SIGTERM");
  const timeout = new AbortController();

  const outcome = await Promise.race([
    exited.then(() => "exited" as const),
    delay(graceMs, "timeout" as const, { signal: timeout.signal }),
  ]);

  timeout.abort();

  if (outcome === "timeout") {
    process.stderr.write(
      `${name} (PID ${child.pid}) did not exit ${graceMs / 1000}s after SIGTERM; sending SIGKILL.\n`,
    );

    child.kill("SIGKILL");
    await exited;
  }
}
