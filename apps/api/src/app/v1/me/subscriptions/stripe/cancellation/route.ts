import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { createWebPlusCancellation } from "@zoonk/core/subscriptions/web-plus-cancellation";
import { NextResponse } from "next/server";

async function createStripeSubscriptionCancellation() {
  const cancellation = await createWebPlusCancellation();

  if (!cancellation) {
    return errors.unauthorized();
  }

  if (cancellation.status === "none") {
    return errors.notFound("No active web subscription");
  }

  return NextResponse.json({ url: cancellation.url });
}

export const POST = withApiErrorBoundary(createStripeSubscriptionCancellation);
