import { type APIRequestContext, request } from "@playwright/test";
import { type Finding } from "./checks.mts";
import { redactQuery } from "./requests.mts";

type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

/** Who a signed-in learner is, as their pages would show them. */
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

/** The signed-in learner, from Better Auth's session endpoint. */
export async function readLearner(
  baseUrl: string,
  storageState: StorageState,
): Promise<Learner | null> {
  const body: unknown = JSON.parse(await read(baseUrl, "/api/auth/get-session", storageState));
  const user = body && typeof body === "object" && "user" in body ? body.user : null;

  return user && typeof user === "object" && "email" in user && "id" in user && "name" in user
    ? { email: String(user.email), id: String(user.id), name: String(user.name) }
    : null;
}

const HTML_ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#x27;",
  "<": "&lt;",
  ">": "&gt;",
};

/** A value as a page can carry it: as is, escaped in its HTML, and escaped in its JSON data. */
function spellings(value: string): string[] {
  return [
    value,
    value.replaceAll(/["&'<>]/gu, (character) => HTML_ESCAPES[character] ?? character),
    JSON.stringify(value).slice(1, -1),
  ];
}

/**
 * What only this learner's private pages carry: their email and account id, and their name when
 * it's a full name (a first name alone, like "Ana", also appears in public lessons).
 */
function identities(learner: Learner): string[] {
  const fullName = learner.name.trim().split(/\s+/u).length > 1 ? [learner.name] : [];
  return [learner.email, learner.id, ...fullName];
}

/** Whether a page someone else opened carries the learner's identity, rendered or in its data. */
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

/**
 * Opens each path as someone who isn't the learner: signed out, and as another learner when one
 * is given. Neither may receive the learner's identity (a missing ownership check, or private
 * data in a cache shared between learners).
 */
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
