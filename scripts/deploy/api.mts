import { setTimeout } from "node:timers/promises";
import { z } from "zod";
import { requiredEnv } from "./config.mts";

const API_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 240;

export async function request({
  url,
  token,
  method = "GET",
  body,
}: {
  url: URL;
  token: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!response.ok) {
    // Provider error bodies can echo credentials from the request.
    throw new Error(`${url.hostname}${url.pathname}: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  return data;
}

export function vercel({
  path,
  method,
  body,
  query,
}: {
  path: string;
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  query?: Record<string, string>;
}): Promise<unknown> {
  const url = new URL(path, "https://api.vercel.com");
  url.search = new URLSearchParams({ teamId: requiredEnv("VERCEL_ORG_ID"), ...query }).toString();
  return request({ body, method, token: requiredEnv("VERCEL_TOKEN"), url });
}

export function github(path: string): Promise<unknown> {
  return request({
    token: requiredEnv("GH_TOKEN"),
    url: new URL(`/repos/${requiredEnv("GITHUB_REPOSITORY")}/${path}`, "https://api.github.com"),
  });
}

const ciRunsSchema = z.object({
  workflow_runs: z.array(
    z.object({
      conclusion: z.string().nullable(),
      event: z.string(),
      head_branch: z.string(),
      id: z.number(),
      status: z.string(),
    }),
  ),
});

export async function getCIRuns(sha: string) {
  const response = await github(`actions/workflows/ci.yml/runs?head_sha=${sha}&per_page=100`);
  return ciRunsSchema.parse(response).workflow_runs;
}

export async function waitFor<T>({
  check,
  description,
  remaining = MAX_POLL_ATTEMPTS,
}: {
  check: () => Promise<T | undefined>;
  description: string;
  remaining?: number;
}): Promise<T> {
  if (remaining === 0) {
    throw new Error(`Timed out waiting for ${description}`);
  }

  const result = await check();

  if (result !== undefined) {
    return result;
  }

  await setTimeout(POLL_INTERVAL_MS);
  return waitFor({ check, description, remaining: remaining - 1 });
}
