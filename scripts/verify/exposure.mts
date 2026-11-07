import { type APIRequestContext, request } from "@playwright/test";
import { type Finding } from "./checks.mts";
import { redactQuery } from "./requests.mts";

type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

export type Learner = { email: string; id: string; name: string };

async function read(baseUrl: string, path: string, storageState?: StorageState) {
  const context = await request.newContext({ baseURL: baseUrl, storageState });

  try {
    const response = await context.get(path);
    return await response.text();
  } finally {
    await context.dispose();
  }
}

const HTML_ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#x27;",
  "<": "&lt;",
  ">": "&gt;",
};

function spellings(value: string): string[] {
  return [
    value,
    value.replaceAll(/["&'<>]/gu, (character) => HTML_ESCAPES[character] ?? character),
    JSON.stringify(value).slice(1, -1),
  ];
}

/**
 * A name counts only when it's a full name: a first name alone, like "Ana", also appears in public
 * lessons.
 */
function identities(learner: Learner): string[] {
  const fullName = learner.name.trim().split(/\s+/u).length > 1 ? [learner.name] : [];
  return [learner.email, learner.id, ...fullName];
}

export function exposureFindings({
  body,
  learner,
  viewer,
}: {
  body: string;
  learner: Learner;
  viewer: string;
}): Finding[] {
  const shown = identities(learner).filter((identity) =>
    spellings(identity).some((spelling) => body.includes(spelling)),
  );

  return shown.length > 0
    ? [
        {
          check: "exposure",
          level: "fail",
          message: `${viewer} got the learner's ${shown.join(" and ")}`,
        },
      ]
    : [];
}

export async function checkExposure({
  baseUrl,
  intruder,
  learner,
  paths,
}: {
  baseUrl: string;
  intruder?: StorageState;
  learner: Learner;
  paths: string[];
}) {
  const viewers = [
    { state: undefined, viewer: "a signed-out visitor" },
    ...(intruder ? [{ state: intruder, viewer: "another learner" }] : []),
  ];

  const checks = paths.flatMap((path) => viewers.map((viewer) => ({ ...viewer, path })));

  return Promise.all(
    checks.map(async ({ path, state, viewer }) => ({
      findings: exposureFindings({ body: await read(baseUrl, path, state), learner, viewer }),
      path: redactQuery(path),
      viewer,
    })),
  );
}
