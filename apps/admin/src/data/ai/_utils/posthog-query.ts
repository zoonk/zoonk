import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { isJsonObject } from "@zoonk/utils/json";

const DEFAULT_POSTHOG_API_HOST = "https://us.posthog.com";
const POSTHOG_TIMEOUT_MS = 20_000;

type PostHogConfig = { apiHost: string; personalApiKey: string; projectId: string };

type HogQLResult =
  | { status: "notConfigured" }
  | { message: string; status: "error" }
  | { columns: string[]; results: unknown[][]; status: "ok" };

/** Reading PostHog needs a personal API key with Query Read access, which only admin has. */
function getPostHogConfig(): PostHogConfig | null {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;

  if (!personalApiKey || !projectId) {
    return null;
  }

  const apiHost = process.env.POSTHOG_API_HOST || DEFAULT_POSTHOG_API_HOST;

  return { apiHost: apiHost.replace(/\/$/u, ""), personalApiKey, projectId };
}

/** PostHog errors carry a `detail` message; anything else falls back to the HTTP status. */
async function readErrorMessage(response: Response): Promise<string> {
  const { data } = await safeAsync<unknown>(() => response.json());
  const detail = isJsonObject(data) ? data.detail : null;

  return typeof detail === "string" && detail
    ? `PostHog returned ${response.status}: ${detail}`
    : `PostHog returned ${response.status}.`;
}

function readQueryResponse(data: unknown): HogQLResult {
  if (!isJsonObject(data) || !Array.isArray(data.results) || !Array.isArray(data.columns)) {
    return { message: "PostHog returned an unexpected response.", status: "error" };
  }

  return {
    columns: data.columns.map(String),
    results: data.results.filter((row) => Array.isArray(row)),
    status: "ok",
  };
}

/**
 * Runs one HogQL query through PostHog's query API. Admin pages show a PostHog outage inline, so
 * every failure comes back as a result instead of throwing.
 */
export async function runHogQLQuery({
  name,
  query,
}: {
  name: string;
  query: string;
}): Promise<HogQLResult> {
  const config = getPostHogConfig();

  if (!config) {
    return { status: "notConfigured" };
  }

  const { data: response, error } = await safeAsync(() =>
    fetch(`${config.apiHost}/api/projects/${config.projectId}/query/`, {
      body: JSON.stringify({ name, query: { kind: "HogQLQuery", query } }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${config.personalApiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(POSTHOG_TIMEOUT_MS),
    }),
  );

  if (error) {
    return { message: `Could not reach PostHog: ${error.message}`, status: "error" };
  }

  if (!response.ok) {
    return { message: await readErrorMessage(response), status: "error" };
  }

  const { data, error: parseError } = await safeAsync<unknown>(() => response.json());

  return parseError
    ? { message: "PostHog returned a response that isn't JSON.", status: "error" }
    : readQueryResponse(data);
}
