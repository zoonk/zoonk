import { type Page } from "@playwright/test";

/** One event of a run's step stream, as the API writes it. */
export type StreamEvent = { entityId?: string; reason?: string; status: string; step: string };

/**
 * Stands in for the API's run: its step stream (read afresh on every connection, so events pushed
 * later arrive when the page reconnects) and its status, still running.
 */
export async function followRun({
  events,
  page,
  runId,
}: {
  events: StreamEvent[];
  page: Page;
  runId: string;
}) {
  await page.route(`**/v1/generations/${runId}/events**`, (route) =>
    route.fulfill({
      body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      contentType: "text/event-stream",
      status: 200,
    }),
  );

  await page.route(`**/v1/generations/${runId}`, (route) =>
    route.fulfill({ json: { id: runId, status: "running" }, status: 200 }),
  );
}

const ANY_RUN_EVENTS = "**/v1/generations/*/events**";
const ANY_RUN_STATUS = /\/v1\/generations\/[^/]+$/u;

/**
 * Stands in for the API saying every run the page follows stopped: E2E runs wait on a model that
 * never answers, and the server's own calls to the API are out of `page.route`'s reach. Returns
 * what lifts it.
 */
export async function stopRuns({ entityId, page }: { entityId?: string; page: Page }) {
  const stopped: StreamEvent = {
    entityId,
    reason: "aiGenerationFailed",
    status: "error",
    step: "workflowError",
  };

  await page.route(ANY_RUN_EVENTS, (route) =>
    route.fulfill({
      body: `data: ${JSON.stringify(stopped)}\n\n`,
      contentType: "text/event-stream",
      status: 200,
    }),
  );

  await page.route(ANY_RUN_STATUS, (route) =>
    route.fulfill({ json: { status: "failed" }, status: 200 }),
  );

  return () => Promise.all([page.unroute(ANY_RUN_EVENTS), page.unroute(ANY_RUN_STATUS)]);
}
