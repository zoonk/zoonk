import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { getWebPlusSubscription } from "@zoonk/core/subscriptions/get-web-plus-subscription";
import { cancelWebPlus, keepWebPlus } from "@zoonk/core/subscriptions/web-plus-cancellation";
import { NextResponse } from "next/server";

const NO_CONTENT = 204;

async function getStripeSubscriptionCancellation() {
  const subscription = await getWebPlusSubscription();

  if (!subscription) {
    return errors.unauthorized();
  }

  if (subscription.status !== "ready") {
    return errors.notFound("No web subscription left to cancel");
  }

  return NextResponse.json({
    periodEnd: subscription.periodEnd?.toISOString() ?? null,
    state: subscription.state,
  });
}

async function cancelStripeSubscription() {
  const outcome = await cancelWebPlus();

  if (!outcome) {
    return errors.unauthorized();
  }

  if (outcome.status === "none") {
    return errors.notFound("No web subscription left to manage");
  }

  if (outcome.status === "unavailable") {
    return errors.conflict("No renewing web subscription to cancel");
  }

  return NextResponse.json({ endsAt: outcome.endsAt.toISOString() });
}

async function resumeStripeSubscription() {
  const outcome = await keepWebPlus();

  if (!outcome) {
    return errors.unauthorized();
  }

  if (outcome.status === "none") {
    return errors.notFound("No web subscription left to manage");
  }

  if (outcome.status === "unavailable") {
    return errors.conflict("Plus isn't set to end with its paid period");
  }

  return new NextResponse(null, { status: NO_CONTENT });
}

export const GET = withApiErrorBoundary(getStripeSubscriptionCancellation);
export const POST = withApiErrorBoundary(cancelStripeSubscription);
export const DELETE = withApiErrorBoundary(resumeStripeSubscription);
