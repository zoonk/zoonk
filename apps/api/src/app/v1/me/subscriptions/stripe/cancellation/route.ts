import { getAppLocale } from "@/i18n/locale";
import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { getAccountDeletionRefund } from "@zoonk/core/subscriptions/web-plus-account-deletion";
import {
  cancelWebPlus,
  getWebPlusCancellation,
  keepWebPlus,
} from "@zoonk/core/subscriptions/web-plus-cancellation";
import { webPlusCancellationRequestSchema } from "@zoonk/core/subscriptions/web-plus-cancellation-contract";
import { type PriceInfo, toMajorUnits } from "@zoonk/utils/currency";
import { type NextRequest, NextResponse } from "next/server";

const NO_CONTENT = 204;

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
  const deletionRefund = getAccountDeletionRefund(cancellation);

  return NextResponse.json({
    accountDeletion: { refund: deletionRefund && toMoney(deletionRefund) },
    canResumeRenewal: cancellation.canResumeRenewal,
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
  const locale = await getAppLocale();
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
