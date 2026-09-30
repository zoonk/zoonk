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
