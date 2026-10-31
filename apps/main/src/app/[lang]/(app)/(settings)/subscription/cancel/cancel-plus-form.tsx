"use client";

import { useRouter } from "@/i18n/navigation";
import { noteAppWrite } from "@/lib/http/app-write-ledger";
import {
  type WebPlusCancellationChoice,
  type WebPlusCancellationRequest,
} from "@zoonk/core/subscriptions/web-plus-cancellation-contract";
import { useAppLocale } from "@zoonk/learn/locale";
import { formatPrice } from "@zoonk/utils/currency";
import { useExtracted, useFormatter } from "next-intl";
import { useState, useTransition } from "react";
import { RefundOffer } from "../refund-offer";
import {
  type CancelChoice,
  CancelChoiceFields,
  CancelFormFooter,
  CancelReview,
  ChoiceSummary,
  RequestDetails,
  readCancellationRequest,
  useCancelReview,
  useLinkedChoice,
} from "./cancel-choices";
import { type CancelPlusResult, cancelPlusAction } from "./cancel-plus-action";

type Receipt = Extract<CancelPlusResult, { status: "canceled" }> & {
  choice: CancelChoice;
  reason: string | null;
};

type Outcome = Receipt | Exclude<CancelPlusResult, { status: "canceled" }>;

function renderDate(chunks: React.ReactNode) {
  return <span className="tabular-nums">{chunks}</span>;
}

function RefundSentence({ receipt }: { receipt: Receipt }) {
  const t = useExtracted();
  const locale = useAppLocale();

  if (!receipt.refund) {
    return null;
  }

  const amount = formatPrice(receipt.refund.amount, receipt.refund.currency, locale);

  if (receipt.choice.value === "withdrawal") {
    return (
      <p>
        {t(
          "We've refunded the full {amount} to the payment method you used. Your bank usually shows it within 5 to 10 business days.",
          { amount },
        )}
      </p>
    );
  }

  if (receipt.choice.value === "extraordinary") {
    return (
      <p>
        {t(
          "We've refunded {amount} for the days left to the payment method you used. Your bank usually shows it within 5 to 10 business days.",
          { amount },
        )}
      </p>
    );
  }

  return (
    <p>
      {t(
        "We've refunded {amount} for the months that haven't started to the payment method you used. Your bank usually shows it within 5 to 10 business days.",
        { amount },
      )}
    </p>
  );
}

function CancelPlusReceipt({
  email,
  receipt,
  timeZone,
}: {
  email: string;
  receipt: Receipt;
  timeZone: string;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const endsNow = receipt.endsAt <= receipt.receivedAt;
  const date = format.dateTime(receipt.endsAt, { dateStyle: "long", timeZone });

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-2" role="status">
        <p className="font-medium">
          {endsNow
            ? t("Plus has ended.")
            : t("You keep Plus until {date}, then it ends.", { date })}
        </p>

        <RefundSentence receipt={receipt} />

        <RequestDetails
          reason={receipt.reason}
          receivedAt={receipt.receivedAt}
          request={receipt.choice.label}
        />

        <p className="text-muted-foreground">
          {t("We've emailed the confirmation to {email}.", { email })}
        </p>
      </div>

      {receipt.refundableUntil && (
        <RefundOffer timeZone={timeZone} until={receipt.refundableUntil} />
      )}
    </div>
  );
}

function CancelPlusAlerts({ result }: { result: Outcome | null }) {
  const t = useExtracted();

  if (result?.status === "failed") {
    return (
      <p className="text-destructive-text text-sm" role="alert">
        {t("We couldn't cancel your subscription. Try again or email hello@zoonk.com.")}
      </p>
    );
  }

  if (result?.status === "unavailable") {
    return (
      <p className="text-sm" role="alert">
        {t("That option isn't available anymore. Check your choice above and try again.")}
      </p>
    );
  }

  return null;
}

/** `reviewFirst` shows France's summary before anything is sent; the form keeps its values. */
export function CancelPlusForm({
  choices,
  email,
  endingAt,
  name,
  plan,
  reviewFirst,
  timeZone,
}: {
  choices: readonly CancelChoice[];
  email: string;
  endingAt: Date | null;
  name: string;
  plan: string;
  reviewFirst: boolean;
  timeZone: string;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const locale = useAppLocale();
  const router = useRouter();
  const linked = useLinkedChoice();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<WebPlusCancellationChoice | null>(linked);
  const [result, setResult] = useState<Outcome | null>(null);
  const { edit, formRef, review, setReview } = useCancelReview<WebPlusCancellationRequest>();
  const choice = choices.find(({ value }) => value === picked) ?? choices[0];

  if (!choice) {
    return null;
  }

  if (result?.status === "canceled") {
    return <CancelPlusReceipt email={email} receipt={result} timeZone={timeZone} />;
  }

  const send = (request: WebPlusCancellationRequest) => {
    const reason = request.choice === "extraordinary" ? (request.reason ?? null) : null;

    startTransition(async () => {
      const outcome = await noteAppWrite(cancelPlusAction({ locale, request })).catch(
        (): CancelPlusResult => ({ status: "failed" }),
      );

      setResult(outcome.status === "canceled" ? { ...outcome, choice, reason } : outcome);

      if (outcome.status === "unavailable") {
        edit();
        router.refresh();
      }
    });
  };

  const submit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const request = readCancellationRequest(choice.value, event.currentTarget);

    if (reviewFirst) {
      setResult(null);
      setReview(request);
      return;
    }

    send(request);
  };

  return (
    <>
      <form
        className="flex flex-col gap-4"
        hidden={review !== null}
        onSubmit={submit}
        ref={formRef}
      >
        {endingAt && (
          <p className="text-sm">
            {t.rich("Your subscription will end on <mono>{date}</mono>.", {
              date: format.dateTime(endingAt, { dateStyle: "long", timeZone }),
              mono: renderDate,
            })}
          </p>
        )}

        <CancelChoiceFields choice={choice.value} choices={choices} onChoiceChange={setPicked} />

        <CancelFormFooter choice={choice.value} pending={pending} reviewFirst={reviewFirst}>
          <CancelPlusAlerts result={result} />
        </CancelFormFooter>
      </form>

      {review && (
        <CancelReview
          choice={review.choice}
          details={
            <RequestDetails
              email={email}
              name={name}
              plan={plan}
              reason={review.choice === "extraordinary" ? (review.reason ?? null) : null}
              request={<ChoiceSummary choice={choice} />}
            />
          }
          onConfirm={() => send(review)}
          onEdit={edit}
          pending={pending}
        >
          <CancelPlusAlerts result={result} />
        </CancelReview>
      )}
    </>
  );
}
