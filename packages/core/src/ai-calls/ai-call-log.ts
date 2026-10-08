import "server-only";
import { waitUntil } from "@vercel/functions";
import { registerAiGenerationSink } from "@zoonk/ai/ai-generation-sink";
import { logError } from "@zoonk/utils/logger";
import { type AiCallRow, toAiCallRow, writeAiCalls } from "./write-ai-calls";

/** Calls that finish together (a goal build runs hundreds at once) are saved in one insert. */
const FLUSH_DELAY_MS = 1000;
const MAX_BATCH = 200;

declare global {
  /** On `globalThis` for the same reason as the sinks: bundles don't share module state. */
  var zoonkAiCallQueue: { flush: Promise<void> | null; rows: AiCallRow[] } | undefined;
}

function getQueue() {
  globalThis.zoonkAiCallQueue ??= { flush: null, rows: [] };
  return globalThis.zoonkAiCallQueue;
}

/** Saves what's queued. A failed write is logged, never retried: the calls already happened. */
async function flushQueue(): Promise<void> {
  const queue = getQueue();
  const rows = queue.rows.splice(0);
  queue.flush = null;

  if (rows.length === 0) {
    return;
  }

  await writeAiCalls(rows).catch((error: unknown) => {
    logError(`[ai-calls] Could not save ${rows.length} AI calls:`, error);
  });
}

function scheduleFlush(): Promise<void> {
  const queue = getQueue();

  if (queue.rows.length >= MAX_BATCH) {
    return flushQueue();
  }

  queue.flush ??= new Promise<void>((resolve) => {
    setTimeout(resolve, FLUSH_DELAY_MS);
  }).then(flushQueue);

  return queue.flush;
}

/**
 * Keeps every AI call in `ai_calls` with its usage and cost, so spend can be tracked in the admin
 * app instead of only in PostHog. Saving stays off the learner's path: a call is queued and the
 * queue is written in one insert a second later (or once it's full), kept alive after the response
 * with `waitUntil`. Apps call this from `instrumentation.ts`, next to the PostHog sink.
 */
export function registerAiCallLog() {
  registerAiGenerationSink("ai-calls", (generation) => {
    getQueue().rows.push(toAiCallRow(generation));
    waitUntil(scheduleFlush());
  });
}
