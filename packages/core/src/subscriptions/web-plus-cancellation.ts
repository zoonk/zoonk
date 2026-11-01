import "server-only";
import { isHumanRequest } from "@zoonk/auth/human-check";
import {
  sendPlusCancellationEmail,
  sendPlusCancellationRequestEmail,
} from "@zoonk/auth/plus-emails";
import { prisma } from "@zoonk/db";
import { type PriceInfo } from "@zoonk/utils/currency";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { io } from "next/cache";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getUserSubscriptionCacheTag } from "../cache/tags";
import { saveFeedbackMessage } from "../feedback/_utils/save-feedback-message";
import { type PlusCancellationRequest } from "../feedback/contract";
import { getSession } from "../users/get-session";
import {
  type Learner,
  type WebPlusCancellation,
  loadCancellation,
} from "./_utils/load-web-plus-cancellation";
import {
  refundLatestPayment,
  resumeSubscription,
  saveStoppedSubscription,
  saveSubscription,
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
 * subscription is saved, which Stripe's webhook writes too.
 */
async function applyCancellation({
  cancellation,
  learner,
  locale,
  option,
  receivedAt,
  request,
  stripeSubscription,
}: {
  cancellation: ReadyCancellation;
  learner: Learner;
  locale: string;
  option: ChosenOption;
  receivedAt: Date;
  request: WebPlusCancellationRequest;
  stripeSubscription: Stripe.Subscription;
}): Promise<CanceledOutcome> {
  const { endsAt } = option;
  const endsNow = endsAt <= receivedAt;
  const refundableUntil = endsNow ? null : (cancellation.withdrawal?.until ?? null);
  const reason = request.choice === "extraordinary" ? (request.reason ?? null) : null;

  const refund =
    option.refundAmount > 0
      ? { amount: option.refundAmount, currency: cancellation.currency }
      : null;

  if (refund) {
    await refundLatestPayment({ owed: option.owed, subscription: stripeSubscription });
  }

  const stopped = await stopSubscription({
    endsAt,
    endsNow,
    reason,
    subscription: stripeSubscription,
  });

  await sendPlusCancellationEmail({
    canKeepPlus: !endsNow && !refund,
    choice: request.choice,
    email: learner.email,
    endsAt,
    interval: cancellation.interval,
    locale,
    name: learner.name,
    reason,
    receivedAt,
    refund,
    refundableUntil,
    source: "settings",
    timeZone: cancellation.timeZone,
  });

  const { error } = await safeAsync(() => saveStoppedSubscription({ stopped, userId: learner.id }));

  if (error) {
    logError("[applyCancellation] Saving the stopped subscription failed:", error);
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
    learner,
    locale,
    option,
    receivedAt,
    request,
    stripeSubscription,
  });
}

const CHOICE_LABELS: Record<WebPlusCancellationChoice, string> = {
  extraordinary: "End now for an important reason, refunding the days left",
  ordinary: "Cancel at the end of the period",
  withdrawal: "Withdrawal, refunding everything (within 14 days of subscribing)",
};

function describeRequest(request: PlusCancellationRequest): string {
  return [
    `Plus cancellation request from the cancel page, without logging in. Received ${request.receivedAt}: a genuine request counts from then.`,
    "",
    `Choice: ${CHOICE_LABELS[request.choice]}`,
    ...(request.reason ? [`Reason: ${request.reason}`] : []),
    `Name: ${request.name}`,
    `Email: ${request.email}`,
    `Account: ${request.userId ?? "no account has this email"}`,
    "",
    "Nothing changed in Stripe. Confirm with the account's owner before acting there.",
  ].join("\n");
}

/**
 * The cancel page's form for visitors who aren't logged in (BGB § 312k; EU Consumer Rights
 * Directive art. 11a). Knowing an account's email mustn't be enough to end its Plus, so the form
 * changes nothing: it reaches support like any message, and support confirms with the account's
 * owner before acting in Stripe. The account's own address gets the receipt the law asks for, in the
 * language and time zone of its newest goal, and the answer is the same whether or not the email
 * matched. Null when the request fails the human check.
 */
export async function requestWebPlusCancellation({
  email,
  locale,
  name,
  request,
}: {
  email: string;
  locale: string;
  name: string;
  request: WebPlusCancellationRequest;
}): Promise<{ receivedAt: Date } | null> {
  if (!(await isHumanRequest())) {
    return null;
  }

  const receivedAt = new Date();

  const user = await prisma.user.findUnique({
    select: {
      email: true,
      goals: { orderBy: { id: "desc" }, select: { language: true, timezone: true }, take: 1 },
      id: true,
    },
    where: { email: email.trim().toLowerCase() },
  });

  const cancellation: PlusCancellationRequest = {
    choice: request.choice,
    email: email.trim(),
    name,
    reason: request.choice === "extraordinary" ? (request.reason ?? null) : null,
    receivedAt: receivedAt.toISOString(),
    userId: user?.id ?? null,
  };

  await saveFeedbackMessage({
    context: { plusCancellation: cancellation },
    email: cancellation.email,
    message: describeRequest(cancellation),
    subject: `Plus cancellation request received ${cancellation.receivedAt.slice(0, 10)}`,
    userId: cancellation.userId,
  });

  if (user) {
    const [goal] = user.goals;

    await sendPlusCancellationRequestEmail({
      choice: request.choice,
      email: user.email,
      locale: goal?.language ?? locale,
      name,
      reason: cancellation.reason,
      receivedAt,
      timeZone: goal?.timezone ?? null,
    });
  }

  return { receivedAt };
}

/**
 * "Keep Plus" after only the renewal was stopped: it renews as before. Null without an account;
 * unavailable once Plus ends sooner, such as after a refund.
 */
export async function keepWebPlus(): Promise<{ status: "kept" | "unavailable" } | null> {
  const learner = await getLearner();

  if (!learner) {
    return null;
  }

  const { cancellation, stripeSubscription } = await loadCancellation({ learner, now: new Date() });

  if (cancellation.status !== "ready" || !cancellation.canResumeRenewal || !stripeSubscription) {
    return { status: "unavailable" };
  }

  const resumed = await resumeSubscription(stripeSubscription);
  await saveSubscription({ subscription: resumed, userId: learner.id });
  revalidateCacheTags([getUserSubscriptionCacheTag(learner.id)]);

  return { status: "kept" };
}
