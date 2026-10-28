import "server-only";
import { waitUntil } from "@vercel/functions";
import { registerAiGenerationSink } from "@zoonk/ai/ai-generation-sink";
import { logError } from "@zoonk/utils/logger";
import { type AiCallRow, toAiCallRow, writeAiCalls } from "./write-ai-calls";

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

export function registerAiCallLog() {
  registerAiGenerationSink("ai-calls", (generation) => {
    getQueue().rows.push(toAiCallRow(generation));
    waitUntil(scheduleFlush());
  });
}
