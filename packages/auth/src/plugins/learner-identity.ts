import { prisma } from "@zoonk/db";
import { markLearnerRevision } from "@zoonk/db/learner-revision";
import { safeAsync } from "@zoonk/utils/error";
import { isJsonObject } from "@zoonk/utils/json";
import { logError } from "@zoonk/utils/logger";
import { type BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware, getEndpoints } from "better-auth/api";

/** Keep bearer and cookie actor selection consistent throughout the hook chain. */
const resolveIdentityActor = createAuthMiddleware(async (context) => {
  /** Header changes from before hooks merge only after the whole chain, so resolve bearer through
   * its own dispatched session endpoint before any other hook can cache the cookie's actor. */
  const session = await getEndpoints(context.context, context.context.options).api.getSession({
    headers: context.headers ?? context.request?.headers ?? new Headers(),
    query: { disableCookieCache: true, disableRefresh: true },
  });

  /** Later before hooks also resolve sessions; they must share the dispatched actor immediately. */
  context.context.session = session;
});

const markIdentityUpdate = createAuthMiddleware(async (context) => {
  const result = context.context.returned;

  if (!isJsonObject(result) || result.status !== true) {
    return;
  }

  const userId = context.context.session?.user.id;

  if (!userId) {
    return;
  }

  /** Every successful provider update marks, including redundant writes: separate before/after
   * snapshots can miss a concurrent transition. A later marker failure cannot undo auth success. */
  const { error } = await safeAsync(() =>
    prisma.$transaction((tx) => markLearnerRevision(tx, { userId })),
  );

  if (error) {
    logError(
      "[learnerIdentity] The identity update succeeded but its learner revision could not be marked",
      error,
    );
  }
});

/** Both mounted auth requests and core's server API updates use this one awaited marker. */
export function learnerIdentityPlugin() {
  return {
    hooks: {
      after: [
        { handler: markIdentityUpdate, matcher: (context) => context.path === "/update-user" },
      ],
      before: [
        { handler: resolveIdentityActor, matcher: (context) => context.path === "/update-user" },
      ],
    },
    id: "learner-identity",
  } satisfies BetterAuthPlugin;
}
