import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import {
  cancelWebPlus,
  getWebPlusCancellation,
  keepWebPlus,
} from "@zoonk/core/subscriptions/web-plus-cancellation";
import { NextResponse } from "next/server";

const NO_CONTENT = 204;

async function getStripeSubscriptionCancellation() {
  const cancellation = await getWebPlusCancellation();

  if (!cancellation) {
    return errors.unauthorized();
  }

  if (cancellation.status !== "ready") {
    return errors.notFound("No web subscription left to cancel");
  }

  return NextResponse.json({
    canResumeRenewal: cancellation.canResumeRenewal,
    cancellation: cancellation.cancellation && {
      endsAt: cancellation.cancellation.endsAt.toISOString(),
    },
    unpaid: cancellation.unpaid,
  });
}

async function cancelStripeSubscription() {
  const outcome = await cancelWebPlus();

  if (!outcome) {
    return errors.unauthorized();
  }

  if (outcome.status === "unavailable") {
    return errors.conflict("No renewing web subscription to cancel");
  }

  return NextResponse.json({
    endsAt: outcome.endsAt.toISOString(),
    receivedAt: outcome.receivedAt.toISOString(),
  });
}

async function resumeStripeSubscription() {
  const outcome = await keepWebPlus();

  if (!outcome) {
    return errors.unauthorized();
  }

  if (outcome.status === "unavailable") {
    return errors.conflict("Plus isn't set to end with its paid period");
  }

  return new NextResponse(null, { status: NO_CONTENT });
}

export const GET = withApiErrorBoundary(getStripeSubscriptionCancellation);
export const POST = withApiErrorBoundary(cancelStripeSubscription);
export const DELETE = withApiErrorBoundary(resumeStripeSubscription);
