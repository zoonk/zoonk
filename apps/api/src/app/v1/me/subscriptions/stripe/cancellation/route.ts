import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import {
  cancelWebPlus,
  getWebPlusCancellation,
} from "@zoonk/core/subscriptions/web-plus-cancellation";
import { webPlusCancellationRequestSchema } from "@zoonk/core/subscriptions/web-plus-cancellation-contract";
import { type PriceInfo, toMajorUnits } from "@zoonk/utils/currency";
import { getLocale } from "next-intl/server";
import { type NextRequest, NextResponse } from "next/server";

function toMoney({ amount, currency }: PriceInfo) {
  return { amount: toMajorUnits(amount, currency), currency: currency.toUpperCase() };
}

function toRefund(amount: number, currency: string) {
  return amount > 0 ? toMoney({ amount, currency }) : null;
}

async function getStripeSubscriptionCancellation() {
  const cancellation = await getWebPlusCancellation();

  if (!cancellation) {
    return errors.unauthorized();
  }

  if (cancellation.status !== "ready") {
    return errors.notFound("No web subscription left to cancel");
  }

  const { currency, extraordinary, withdrawal } = cancellation;

  return NextResponse.json({
    cancellation: cancellation.cancellation && {
      endsAt: cancellation.cancellation.endsAt.toISOString(),
      refund: toRefund(cancellation.cancellation.refundAmount, currency),
    },
    extraordinary: extraordinary && { refund: toRefund(extraordinary.refundAmount, currency) },
    withdrawal: withdrawal && {
      refund: toMoney({ amount: withdrawal.refundAmount, currency }),
      until: withdrawal.until.toISOString(),
    },
  });
}

async function cancelStripeSubscription(request: NextRequest) {
  const body = await readBody(request, webPlusCancellationRequestSchema);
  const locale = await getLocale();
  const outcome = await cancelWebPlus({ locale, request: body });

  if (!outcome) {
    return errors.unauthorized();
  }

  if (outcome.status === "unavailable") {
    return errors.conflict("That choice isn't open anymore");
  }

  return NextResponse.json({
    endsAt: outcome.endsAt.toISOString(),
    receivedAt: outcome.receivedAt.toISOString(),
    refund: outcome.refund && toMoney(outcome.refund),
  });
}

export const GET = withApiErrorBoundary(getStripeSubscriptionCancellation);
export const POST = withApiErrorBoundary(cancelStripeSubscription);
