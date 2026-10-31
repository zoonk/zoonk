import "server-only";
import { isHumanRequest } from "@zoonk/auth/human-check";
import { sendPlusCancellationEmail } from "@zoonk/auth/plus-emails";
import { prisma } from "@zoonk/db";
import { type PriceInfo } from "@zoonk/utils/currency";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { io } from "next/cache";
import { getSession } from "../users/get-session";
import {
  type Learner,
  type WebPlusCancellation,
  loadCancellation,
} from "./_utils/load-web-plus-cancellation";
import {
  refundLatestPayment,
  saveStoppedSubscription,
  stopSubscription,
} from "./_utils/stop-web-plus";
import {
  type WebPlusCancellationChoice,
  type WebPlusCancellationRequest,
} from "./web-plus-cancellation-contract";
import type Stripe from "stripe";

export type { WebPlusCancellation } from "./_utils/load-web-plus-cancellation";

type CanceledOutcome = {
  status: "canceled";
  endsAt: Date;
  receivedAt: Date;
  refund: PriceInfo | null;
  /** Stopping the renewal leaves the 14-day refund open until this day. */
  refundableUntil: Date | null;
};

export type WebPlusCancellationOutcome = CanceledOutcome | { status: "unavailable" };

type ReadyCancellation = Extract<WebPlusCancellation, { status: "ready" }>;
type ChosenOption = { endsAt: Date; owed: number; refundAmount: number };

async function getLearner(): Promise<Learner | null> {
  const session = await getSession();
  return session && !session.user.isAnonymous ? session.user : null;
}

/** What canceling the learner's Plus would do. Null without an account: a guest has no Plus. */
export async function getWebPlusCancellation(): Promise<WebPlusCancellation | null> {
  const learner = await getLearner();

  if (!learner) {
    return null;
  }

  await io();

  const { cancellation } = await loadCancellation({ learner, now: new Date() });

  return cancellation;
}

function getOptions(
  cancellation: ReadyCancellation,
  receivedAt: Date,
): Record<WebPlusCancellationChoice, ChosenOption | null> {
  const { extraordinary, withdrawal } = cancellation;
  const ordinary = cancellation.cancellation;

  return {
    extraordinary: extraordinary && {
      endsAt: receivedAt,
      owed: extraordinary.owed,
      refundAmount: extraordinary.refundAmount,
    },
    ordinary: ordinary && {
      endsAt: ordinary.endsAt,
      owed: ordinary.refundAmount,
      refundAmount: ordinary.refundAmount,
    },
    withdrawal: withdrawal && {
      endsAt: receivedAt,
      owed: withdrawal.refundAmount,
      refundAmount: withdrawal.refundAmount,
    },
  };
}

/**
 * The refund goes first, so a failure never leaves Plus ended without it, and a retry finishes what
 * a failed request started. Once Stripe stops Plus, the receipt goes out before our copy of the
 * subscription is saved, which Stripe's webhook writes too. Without an option, Plus is already
 * ending as asked and only the receipt goes out.
 */
async function applyCancellation({
  cancellation,
  lateWithdrawal,
  learner,
  locale,
  option,
  receivedAt,
  request,
  stripeSubscription,
}: {
  cancellation: ReadyCancellation;
  lateWithdrawal: boolean;
  learner: Learner;
  locale: string;
  option: ChosenOption | null;
  receivedAt: Date;
  request: WebPlusCancellationRequest;
  stripeSubscription: Stripe.Subscription;
}): Promise<CanceledOutcome> {
  const endsAt = option?.endsAt ?? cancellation.endingAt ?? receivedAt;
  const endsNow = endsAt <= receivedAt;
  const refundableUntil = endsNow ? null : (cancellation.withdrawal?.until ?? null);
  const reason = request.choice === "extraordinary" ? (request.reason ?? null) : null;

  const refund =
    option && option.refundAmount > 0
      ? { amount: option.refundAmount, currency: cancellation.currency }
      : null;

  if (option && refund) {
    await refundLatestPayment({ owed: option.owed, subscription: stripeSubscription });
  }

  const stopped =
    option &&
    (await stopSubscription({ endsAt, endsNow, reason, subscription: stripeSubscription }));

  await sendPlusCancellationEmail({
    choice: request.choice,
    email: learner.email,
    endsAt,
    interval: cancellation.interval,
    lateWithdrawal,
    locale,
    name: learner.name,
    reason,
    receivedAt,
    refund,
    refundableUntil,
  });

  if (stopped) {
    const { error } = await safeAsync(() =>
      saveStoppedSubscription({ stopped, userId: learner.id }),
    );

    if (error) {
      logError("[applyCancellation] Saving the stopped subscription failed:", error);
    }
  }

  return { endsAt, receivedAt, refund, refundableUntil, status: "canceled" };
}

/**
 * Caches aren't expired: main keeps the receipt on screen and reads its pages again when the learner
 * leaves. The receipt is emailed in `locale`. Null without an account.
 */
export async function cancelWebPlus({
  locale,
  request,
}: {
  locale: string;
  request: WebPlusCancellationRequest;
}): Promise<WebPlusCancellationOutcome | null> {
  const learner = await getLearner();

  if (!learner) {
    return null;
  }

  const receivedAt = new Date();
  const { cancellation, stripeSubscription } = await loadCancellation({ learner, now: receivedAt });

  const option =
    cancellation.status === "ready" ? getOptions(cancellation, receivedAt)[request.choice] : null;

  if (cancellation.status !== "ready" || !option || !stripeSubscription) {
    return { status: "unavailable" };
  }

  return applyCancellation({
    cancellation,
    lateWithdrawal: false,
    learner,
    locale,
    option,
    receivedAt,
    request,
    stripeSubscription,
  });
}

async function cancelForDeclaration({
  email,
  locale,
  name,
  receivedAt,
  request,
}: {
  email: string;
  locale: string;
  name: string;
  receivedAt: Date;
  request: WebPlusCancellationRequest;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    select: { email: true, id: true },
    where: { email: email.trim().toLowerCase() },
  });

  if (!user) {
    return;
  }

  const learner = { email: user.email, id: user.id, name };
  const { cancellation, stripeSubscription } = await loadCancellation({ learner, now: receivedAt });

  if (cancellation.status !== "ready" || !stripeSubscription) {
    return;
  }

  const options = getOptions(cancellation, receivedAt);

  // A visitor can't see which choices are open, so a withdrawal after its 14 days, or any choice
  // on an unpaid renewal, becomes the ordinary cancellation it can still be (BGB § 140).
  await applyCancellation({
    cancellation,
    lateWithdrawal: request.choice === "withdrawal" && !options.withdrawal,
    learner,
    locale,
    option: options[request.choice] ?? options.ordinary,
    receivedAt,
    request,
    stripeSubscription,
  });
}

/**
 * The cancel page's form for visitors who aren't logged in (BGB § 312k; EU Consumer Rights
 * Directive art. 11a). Whoever knows an account's email can cancel its website Plus, as the law
 * asks, so the answer is the same whether or not the email matched, and the confirmation goes only
 * to the account's own address. A failure throws so the visitor can send it again, and the retry
 * finishes what the failed one started. Null when the request fails the human check.
 */
export async function requestWebPlusCancellation(declaration: {
  email: string;
  locale: string;
  name: string;
  request: WebPlusCancellationRequest;
}): Promise<{ receivedAt: Date } | null> {
  if (!(await isHumanRequest())) {
    return null;
  }

  const receivedAt = new Date();
  await cancelForDeclaration({ ...declaration, receivedAt });
  return { receivedAt };
}
