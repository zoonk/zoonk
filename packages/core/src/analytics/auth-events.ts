import "server-only";
import { type AuthEvent, registerAuthEventSink } from "@zoonk/auth/auth-events";
import { prisma } from "@zoonk/db";
import { after } from "next/server";
import { type AnalyticsEvent } from "./events";
import { trackLearnerEvents } from "./track-learner-event";

async function hasGuestLearning(userId: string): Promise<boolean> {
  const where = { userId };

  const [goal, event] = await Promise.all([
    prisma.goal.findFirst({ select: { id: true }, where }),
    prisma.learningEvent.findFirst({ select: { id: true }, where }),
  ]);

  return Boolean(goal ?? event);
}

async function toAnalyticsEvent(event: AuthEvent): Promise<AnalyticsEvent> {
  if (event.name === "sign-in") {
    return { name: "Sign In Method Chosen", properties: { method: event.method } };
  }

  return {
    name: "Sign Up Completed",
    properties: { from_guest: await hasGuestLearning(event.userId) },
  };
}

export function registerAuthAnalytics(): void {
  registerAuthEventSink(async (event) => {
    after(async () => {
      await trackLearnerEvents({ events: [await toAnalyticsEvent(event)], userId: event.userId });
    });
  });
}
