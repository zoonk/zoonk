import { type APIRequestContext, request } from "@playwright/test";
import { type Finding } from "./checks.mts";

type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

/** Who a signed-in learner is, as their pages would show them. */
export type Learner = { email: string; name: string };

/** A name this short could appear anywhere, so only longer names count as the learner's. */
const MIN_NAME_LENGTH = 3;

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

  return user && typeof user === "object" && "email" in user && "name" in user
    ? { email: String(user.email), name: String(user.name) }
    : null;
}

/** Whether a page someone else opened carries the learner's email or name, rendered or in its data. */
export function exposureFindings({
  body,
  learner,
  viewer,
}: {
  body: string;
  learner: Learner;
  viewer: string;
}): Finding[] {
  const shown = [
    body.includes(learner.email) && learner.email,
    learner.name.length >= MIN_NAME_LENGTH && body.includes(learner.name) && learner.name,
  ].filter((value) => value !== false);

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
 * is given. Neither may receive the learner's email or name (a missing ownership check, or private
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
      path,
      viewer,
    })),
  );
}
