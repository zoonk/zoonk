import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { runHogQLQuery } from "@/data/ai/_utils/posthog-query";
import { isUuid } from "@zoonk/utils/uuid";

/** Learner signals are read over a quarter, long enough for a new lesson to collect taps. */
export const DEPTH_REQUEST_PERIOD_DAYS = 90;

export type DepthRequests = { deeper: number; simpler: number };

export type DepthRequestsResult =
  | { message: string; status: "error" }
  | { status: "notConfigured" }
  | { requests: Map<string, DepthRequests>; status: "ok" };

const NO_REQUESTS: DepthRequests = { deeper: 0, simpler: 0 };

/**
 * "Simpler" and "Go deeper" taps live in PostHog: the player sends `Depth Requested` with the
 * screen's `step_id` and `depth` on every tap, whether the version already existed or not.
 */
function buildQuery(stepIds: readonly string[]): string {
  const ids = stepIds.map((id) => `'${id}'`).join(", ");

  return `
    SELECT properties.step_id AS step_id, properties.depth AS depth, count() AS taps
    FROM events
    WHERE event = 'Depth Requested'
      AND timestamp >= now() - INTERVAL ${DEPTH_REQUEST_PERIOD_DAYS} DAY
      AND properties.step_id IN (${ids})
    GROUP BY step_id, depth
  `;
}

function toCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

/** Rows are positional arrays, so each value is read by its column name. */
function toRequests(columns: string[], rows: unknown[][]): Map<string, DepthRequests> {
  const read = (row: unknown[], column: string) => row[columns.indexOf(column)];

  return rows.reduce((requests, row) => {
    const stepId = String(read(row, "step_id"));
    const depth = read(row, "depth");
    const current = requests.get(stepId) ?? NO_REQUESTS;

    if (depth !== "simpler" && depth !== "deeper") {
      return requests;
    }

    return requests.set(stepId, {
      ...current,
      [depth]: current[depth] + toCount(read(row, "taps")),
    });
  }, new Map<string, DepthRequests>());
}

const cachedGetDepthRequests = cacheAdminData(async (stepIdsKey: string) => {
  const stepIds = stepIdsKey ? stepIdsKey.split(",") : [];

  if (stepIds.length === 0) {
    return { requests: new Map<string, DepthRequests>(), status: "ok" as const };
  }

  const result = await runHogQLQuery({
    name: "admin depth requests by screen",
    query: buildQuery(stepIds),
  });

  if (result.status !== "ok") {
    return result;
  }

  return { requests: toRequests(result.columns, result.results), status: "ok" as const };
});

/**
 * How often learners asked for a "Simpler" or "Go deeper" version of each screen in the last 90
 * days, so a screen many learners find hard stands out before admins rewrite the lesson. Only
 * UUIDs reach the query, so the ids are safe to inline.
 */
export async function getDepthRequests(stepIds: readonly string[]): Promise<DepthRequestsResult> {
  return cachedGetDepthRequests(
    stepIds
      .filter((id) => isUuid(id))
      .toSorted()
      .join(","),
  );
}

/** A screen nobody asked about has zero of each. */
export function readDepthRequests(
  requests: Map<string, DepthRequests>,
  stepId: string,
): DepthRequests {
  return requests.get(stepId) ?? NO_REQUESTS;
}
