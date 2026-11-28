"use client";

import { postFromBrowser } from "@/lib/api/browser-api";
import { readRefusedLimit } from "@/lib/api/refused-limit";
import {
  type CodeRunPhase,
  type CodeRunResult,
  codeRunPhaseSchema,
  codeRunResultSchema,
} from "@zoonk/core/library/activities/sandbox-contract";
import { type CodeRunOutcome, type RunCode } from "@zoonk/player/lesson/types";
import { safeAsync } from "@zoonk/utils/error";
import { createParser } from "eventsource-parser";

const HTTP_CONFLICT = 409;
const OFFLINE: CodeRunOutcome = { status: "offline" };
const UNAVAILABLE: CodeRunOutcome = { status: "unavailable" };

function readJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toFinished(result: CodeRunResult): CodeRunOutcome {
  return result.stop === "unavailable" ? UNAVAILABLE : { result, status: "finished" };
}

/** A stream that ends before its result broke off on the way, so it counts as offline. */
async function readRunStream({
  body,
  onPhase,
}: {
  body: ReadableStream<Uint8Array>;
  onPhase: (phase: CodeRunPhase) => void;
}): Promise<CodeRunOutcome> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const read: { outcome: CodeRunOutcome | null } = { outcome: null };

  const parser = createParser({
    onEvent: (event) => {
      const data = readJson(event.data);

      if (event.event === "phase") {
        const phase = codeRunPhaseSchema.safeParse(data);

        if (phase.success) {
          onPhase(phase.data.phase);
        }
      }

      if (event.event === "result") {
        const result = codeRunResultSchema.safeParse(data);
        read.outcome = result.success ? toFinished(result.data) : UNAVAILABLE;
      }
    },
  });

  await safeAsync(async () => {
    let chunk = await reader.read();

    /* eslint-disable no-await-in-loop -- A stream is read in order, one chunk at a time. */
    while (!chunk.done) {
      parser.feed(decoder.decode(chunk.value, { stream: true }));
      chunk = await reader.read();
    }
    /* eslint-enable no-await-in-loop */

    parser.feed(decoder.decode());
  });

  return read.outcome ?? OFFLINE;
}

async function toCodeRunOutcome({
  onPhase,
  response,
}: {
  onPhase: (phase: CodeRunPhase) => void;
  response: Response;
}): Promise<CodeRunOutcome> {
  if (response.ok) {
    return response.body ? readRunStream({ body: response.body, onPhase }) : OFFLINE;
  }

  if (response.status === HTTP_CONFLICT) {
    return { status: "alreadyRunning" };
  }

  const body: unknown = await response.json().catch(() => null);
  return readRefusedLimit({ body, status: response.status }) ?? UNAVAILABLE;
}

/** From the browser, since a run takes seconds and would hold up the lesson's Server Actions. */
export const requestCodeRun: RunCode = async ({ code, language, onPhase, requestId }) => {
  const response = await postFromBrowser({
    body: { code, language, requestId },
    path: "/v1/code-runs",
  });

  return response ? toCodeRunOutcome({ onPhase, response }) : OFFLINE;
};
