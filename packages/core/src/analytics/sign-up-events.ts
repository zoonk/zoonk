import "server-only";
import { registerSignUpSink } from "@zoonk/auth/sign-up-events";
import { prisma } from "@zoonk/db";
import { after } from "next/server";
import { trackLearnerEvents } from "./track-learner-event";

async function hasGuestLearning(userId: string): Promise<boolean> {
  const where = { userId };

  const [goal, event] = await Promise.all([
    prisma.goal.findFirst({ select: { id: true }, where }),
    prisma.learningEvent.findFirst({ select: { id: true }, where }),
  ]);

  return Boolean(goal ?? event);
}

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
