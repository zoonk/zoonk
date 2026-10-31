import {
  PROGRAM_TIME_LIMIT_MS,
  type ProgramKind,
} from "@zoonk/core/library/activities/program-limits";
import {
  JAVASCRIPT_WORKER_SOURCE,
  PYTHON_WORKER_SOURCE,
  SQL_WORKER_SOURCE,
} from "./sandbox-sources";

export type SandboxMessage =
  | { type: "ready" }
  | { type: "loadError"; message: string }
  | { type: "output"; id: number; stream: "stderr" | "stdout"; text: string }
  | { type: "log"; id: number; stream: "stderr" | "stdout"; args: unknown[] }
  | { type: "done"; id: number; table?: { columns: string[]; rows: unknown[][] } }
  | { type: "error"; id: number; line?: number | null; message: string };

type SandboxOutcome =
  | { status: "done"; table?: { columns: string[]; rows: unknown[][] } }
  | { status: "error"; line: number | null; message: string }
  | { status: "timeout" }
  | { status: "unavailable" };

type Host = { ready: Promise<boolean>; worker: Worker };

const SOURCES: Record<ProgramKind, { module: boolean; source: string }> = {
  javascript: { module: false, source: JAVASCRIPT_WORKER_SOURCE },
  python: { module: true, source: PYTHON_WORKER_SOURCE },
  sql: { module: false, source: SQL_WORKER_SOURCE },
};

const hosts = new Map<ProgramKind, Host>();
const runIds = { next: 1 };

function createHost(kind: ProgramKind): Host {
  const { module, source } = SOURCES[kind];
  // A data URL gives the worker no origin, so learner code can't send the learner's cookies or
  // read the page's data; a Blob URL would share the page's origin.
  const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
  const worker = new Worker(url, { name: `zoonk-${kind}`, type: module ? "module" : "classic" });

  const ready = new Promise<boolean>((resolve) => {
    function handleMessage(event: MessageEvent<SandboxMessage>) {
      if (event.data.type !== "ready" && event.data.type !== "loadError") {
        return;
      }

      worker.removeEventListener("message", handleMessage);
      resolve(event.data.type === "ready");
    }

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", () => resolve(false), { once: true });
  });

  return { ready, worker };
}

function getHost(kind: ProgramKind): Host {
  const existing = hosts.get(kind);

  if (existing) {
    return existing;
  }

  const host = createHost(kind);

  if (kind !== "javascript") {
    hosts.set(kind, host);
  }

  return host;
}

function discardHost(kind: ProgramKind, host: Host) {
  host.worker.terminate();

  if (hosts.get(kind) === host) {
    hosts.delete(kind);
  }
}

export async function warmUpSandbox(kind: ProgramKind): Promise<boolean> {
  if (kind === "javascript") {
    return true;
  }

  const host = getHost(kind);
  const isReady = await host.ready;

  if (!isReady) {
    discardHost(kind, host);
  }

  return isReady;
}

type RunRequest = {
  kind: ProgramKind;
  payload: Record<string, unknown>;
  /** Called with every `output`/`log` message; return false to stop the run (too much output). */
  onMessage: (message: SandboxMessage) => boolean;
};

export async function runInSandbox({
  kind,
  onMessage,
  payload,
}: RunRequest): Promise<SandboxOutcome> {
  const host = getHost(kind);

  if (!(await host.ready)) {
    discardHost(kind, host);
    return { status: "unavailable" };
  }

  const id = runIds.next;
  runIds.next += 1;

  return new Promise<SandboxOutcome>((resolve) => {
    function finish(outcome: SandboxOutcome, keepWorker: boolean) {
      clearTimeout(timer);
      host.worker.removeEventListener("message", handleMessage);

      if (!keepWorker || kind === "javascript") {
        discardHost(kind, host);
      }

      resolve(outcome);
    }

    function handleMessage(event: MessageEvent<SandboxMessage>) {
      const message = event.data;

      if (!("id" in message) || message.id !== id) {
        return;
      }

      if (message.type === "done") {
        finish({ status: "done", table: message.table }, true);
        return;
      }

      if (message.type === "error") {
        finish({ line: message.line ?? null, message: message.message, status: "error" }, true);
        return;
      }

      if (!onMessage(message)) {
        finish({ status: "done" }, false);
      }
    }

    const timer = setTimeout(
      () => finish({ status: "timeout" }, false),
      PROGRAM_TIME_LIMIT_MS[kind],
    );

    host.worker.addEventListener("message", handleMessage);
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- A Worker's postMessage has no target origin; the rule is for windows.
    host.worker.postMessage({ ...payload, id });
  });
}
