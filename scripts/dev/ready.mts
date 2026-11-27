import { setTimeout as sleep } from "node:timers/promises";

const POLL_MS = 1000;
const REQUEST_TIMEOUT_MS = 5000;
const SERVER_ERROR = 500;
const NOT_FOUND = 404;
const FIRST_REDIRECT = 300;
const FIRST_CLIENT_ERROR = 400;

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

export function redirectsToItself({
  location,
  status,
  url,
}: {
  location: string | null;
  status: number;
  url: string;
}): boolean {
  return (
    status >= FIRST_REDIRECT &&
    status < FIRST_CLIENT_ERROR &&
    location !== null &&
    new URL(location, url).href === new URL(url).href
  );
}

type Answer = { loops: boolean; service: Service };

async function getAnswer(service: Service): Promise<Answer | null> {
  try {
    const response = await fetch(service.url, {
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const body = await response.text();

    if (!isAppAnswer({ body, status: response.status })) {
      return null;
    }

    const location = response.headers.get("location");

    return {
      loops: redirectsToItself({ location, status: response.status, url: service.url }),
      service,
    };
  } catch {
    return null;
  }
}

async function getEveryAnswer(services: Service[]): Promise<Answer[] | null> {
  const answers = await Promise.all(services.map(async (service) => getAnswer(service)));
  const answered = answers.filter((answer) => answer !== null);

  return answered.length === services.length ? answered : null;
}

async function waitForEveryAnswer({
  services,
  signal,
}: {
  services: Service[];
  signal: AbortSignal;
}): Promise<Answer[]> {
  const answers = await getEveryAnswer(services);

  if (answers) {
    return answers;
  }

  await sleep(POLL_MS, undefined, { signal });

  return waitForEveryAnswer({ services, signal });
}

function formatLoop({ name, url }: Service): string {
  return `${getLabel(name)} redirects ${url} to itself, so a browser can't open it.`;
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
  const answers = await waitForEveryAnswer({ services, signal }).catch(() => null);

  if (!answers || signal.aborted) {
    return;
  }

  const loops = answers.filter((answer) => answer.loops).map((answer) => answer.service);

  if (loops.length > 0) {
    process.stderr.write(`\n${loops.map((service) => formatLoop(service)).join("\n")}\n\n`);
    return;
  }

  process.stdout.write(`\nReady\n${formatServices(services)}\n\n`);
}
