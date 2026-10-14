import { readFile } from "node:fs/promises";
import { stripVTControlCharacters } from "node:util";

const VALIDATION_TIMEOUT_MS = 60_000;
const VALIDATION_POLL_MS = 100;

/** Next's test-mode lifecycle includes background validation and delivery after the HTTP body finishes. */
export async function waitForPrerenderValidation({
  logPath,
  requestId,
  timeoutMs = VALIDATION_TIMEOUT_MS,
}: {
  logPath: string;
  requestId: string;
  timeoutMs?: number;
}) {
  const deadline = performance.now() + timeoutMs;

  while (performance.now() < deadline) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for this request's actual validation completion, not elapsed time.
    const output = stripVTControlCharacters(await readFile(logPath, "utf8"));

    const events = [...output.matchAll(/<VALIDATION_MESSAGE>(?<event>.*?)<\/VALIDATION_MESSAGE>/gu)]
      .map((match): unknown => JSON.parse(match.groups?.event ?? "null"))
      .filter(
        (event): event is { requestId: string; responseFinished?: boolean; type: string } =>
          typeof event === "object" &&
          event !== null &&
          "requestId" in event &&
          event.requestId === requestId &&
          "type" in event &&
          typeof event.type === "string",
      );

    if (events.some((event) => event.type === "validation_aborted")) {
      throw new Error(`Prerender validation aborted for ${requestId}.`);
    }

    const start = events.find((event) => event.type === "validation_start");

    if (start && events.some((event) => event.type === "validation_end")) {
      if (start.responseFinished !== true) {
        throw new Error(`Prerender validation was skipped for ${requestId}.`);
      }

      return;
    }

    // oxlint-disable-next-line eslint/no-await-in-loop -- Poll an observable framework completion event within the deadline.
    await new Promise((resolve) => {
      setTimeout(resolve, VALIDATION_POLL_MS);
    });
  }

  throw new Error(`Prerender validation did not complete for ${requestId} within ${timeoutMs}ms.`);
}
