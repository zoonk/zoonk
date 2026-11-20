import { setTimeout as sleep } from "node:timers/promises";

const POLL_MS = 1000;
const REQUEST_TIMEOUT_MS = 5000;
const SERVER_ERROR = 500;
const NOT_FOUND = 404;

// Main and the API first: every sign-in and native build points at them.
const SERVICE_ORDER = ["main", "api"];

export type Service = { name: string; url: string };

function getLabel(name: string): string {
  return name === "api" ? "API" : `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

function getRank(name: string): number {
  const rank = SERVICE_ORDER.indexOf(name);

  return rank === -1 ? SERVICE_ORDER.length : rank;
}

export function sortServices(names: string[]): string[] {
  return names.toSorted(
    (first, second) => getRank(first) - getRank(second) || first.localeCompare(second),
  );
}

export function formatServices(services: Service[]): string {
  const width = Math.max(...services.map((service) => getLabel(service.name).length));

  return services
    .map((service) => `  ${getLabel(service.name).padEnd(width)}  ${service.url}`)
    .join("\n");
}

/** Until an app registers, the proxy answers for it with its own 404, then with 502 until the app listens. */
export function isAppAnswer({ body, status }: { body: string; status: number }): boolean {
  return status < SERVER_ERROR && !(status === NOT_FOUND && body.includes("No app registered"));
}

async function answers(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    return isAppAnswer({ body: await response.text(), status: response.status });
  } catch {
    return false;
  }
}

async function everyAppAnswers(services: Service[]): Promise<boolean> {
  const up = await Promise.all(services.map(async ({ url }) => answers(url)));

  return up.every(Boolean);
}

/**
 * Prints the URLs again once every app answers, under the build and startup logs that pushed the
 * first list off the screen. `signal` ends the wait when the stack stops first.
 */
export async function announceWhenReady({
  services,
  signal,
}: {
  services: Service[];
  signal: AbortSignal;
}): Promise<void> {
  try {
    // oxlint-disable-next-line no-await-in-loop -- polls until every app answers
    while (!(await everyAppAnswers(services))) {
      // oxlint-disable-next-line no-await-in-loop -- waits between polls
      await sleep(POLL_MS, undefined, { signal });
    }
  } catch {
    return;
  }

  if (!signal.aborted) {
    process.stdout.write(`\nReady\n${formatServices(services)}\n\n`);
  }
}
