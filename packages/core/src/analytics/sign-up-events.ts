import "server-only";
import { registerSignUpSink } from "@zoonk/auth/sign-up-events";
import { prisma } from "@zoonk/db";
import { after } from "next/server";
import { trackLearnerEvents } from "./track-learner-event";

/**
 * Whether the new account carries a guest's learning: a guest who signs up brings their goals and
 * lessons, and a new account has none of its own yet.
 */
async function hasGuestLearning(userId: string): Promise<boolean> {
  const where = { userId };

  const [goal, event] = await Promise.all([
    prisma.goal.findFirst({ select: { id: true }, where }),
    prisma.learningEvent.findFirst({ select: { id: true }, where }),
  ]);

  return Boolean(goal ?? event);
}

/**
 * Sends "Sign Up Completed" once per account, when Better Auth creates it, on the web or in the
 * native apps. It runs after the response, so a guest whose sign-up moves their learning in the
 * same request is reported as one. Each app that serves Better Auth calls this from
 * `instrumentation.ts`, since `@zoonk/auth` can't depend on core.
 */
export function registerSignUpAnalytics(): void {
  registerSignUpSink(async ({ userId }) => {
    after(async () => {
      const fromGuest = await hasGuestLearning(userId);

      await trackLearnerEvents({
        events: [{ name: "Sign Up Completed", properties: { from_guest: fromGuest } }],
        userId,
      });
    });
  });
}
