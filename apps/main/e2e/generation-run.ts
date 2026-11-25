import { type Page } from "@playwright/test";

export type StreamEvent = {
  at?: number;
  entityId?: string;
  lessonId?: string;
  lessonTitle?: string;
  reason?: string;
  status: string;
  step: string;
  warmUpId?: string;
};

/** The step stream is read afresh on every connection, so events pushed later arrive when the page reconnects. */
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
 * E2E runs wait on a model that never answers, and the server's own calls to the API are out of
 * `page.route`'s reach. Returns what lifts it.
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

/**
 * Only the API's readiness can say a run is writing a lesson, and it can't find a run faked with
 * `followRun`: it would call that lesson's writing stopped. This answers for the API as it would
 * for a live run.
 */
export async function confirmLessonWriter({
  lessonId,
  page,
  runId,
}: {
  lessonId: string;
  page: Page;
  runId: string;
}) {
  await page.route(`**/v1/library/lessons/${lessonId}/readiness`, (route) =>
    route.fulfill({
      json: {
        alternative: null,
        generationId: runId,
        kind: "lesson",
        setAside: false,
        status: "generating",
        warmUpId: null,
      },
      status: 200,
    }),
  );
}
