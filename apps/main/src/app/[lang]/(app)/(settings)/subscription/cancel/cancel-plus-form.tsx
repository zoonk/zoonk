"use client";

import { useRouter } from "@/i18n/navigation";
import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { type WebPlusCancellationChoice } from "@zoonk/core/subscriptions/web-plus-cancellation-contract";
import { useFormatter } from "@zoonk/learn/formatter";
import { formatPrice } from "@zoonk/utils/currency";
import { useExtracted, useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { RefundOffer } from "../refund-offer";
import {
  type CancelChoice,
  CancelChoiceFields,
  CancelFormFooter,
  ReceiptDetails,
  readCancellationRequest,
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
  const locale = useLocale();

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

function CancelPlusReceipt({ email, receipt }: { email: string; receipt: Receipt }) {
  const t = useExtracted();
  const format = useFormatter();
  const endsNow = receipt.endsAt <= receipt.receivedAt;
  const date = format.dateTime(receipt.endsAt, { dateStyle: "long" });

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-2" role="status">
        <p className="font-medium">
          {endsNow
            ? t("Plus has ended.")
            : t("You keep Plus until {date}, then it ends.", { date })}
        </p>

        <RefundSentence receipt={receipt} />

        <ReceiptDetails
          choiceLabel={receipt.choice.label}
          reason={receipt.reason}
          receivedAt={receipt.receivedAt}
        />

        <p className="text-muted-foreground">
          {t("We've emailed the confirmation to {email}.", { email })}
        </p>
      </div>

      {receipt.refundableUntil && <RefundOffer until={receipt.refundableUntil} />}
    </div>
  );
}

export function CancelPlusForm({
  choices,
  email,
  endingAt,
}: {
  choices: readonly CancelChoice[];
  email: string;
  endingAt: Date | null;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const linked = useLinkedChoice();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<WebPlusCancellationChoice | null>(linked);
  const [result, setResult] = useState<Outcome | null>(null);
  const choice = choices.find(({ value }) => value === picked) ?? choices[0];

  if (!choice) {
    return null;
  }

  if (result?.status === "canceled") {
    return <CancelPlusReceipt email={email} receipt={result} />;
  }

  const submit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const request = readCancellationRequest(choice.value, event.currentTarget);
    const reason = request.choice === "extraordinary" ? (request.reason ?? null) : null;

    startTransition(async () => {
      const outcome = await noteAppWrite(cancelPlusAction({ locale, request })).catch(
        (): CancelPlusResult => ({ status: "failed" }),
      );

      setResult(outcome.status === "canceled" ? { ...outcome, choice, reason } : outcome);

      if (outcome.status === "unavailable") {
        router.refresh();
      }
    });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      {endingAt && (
        <p className="text-sm">
          {t.rich("Your subscription will end on <mono>{date}</mono>.", {
            date: format.dateTime(endingAt, { dateStyle: "long" }),
            mono: renderDate,
          })}
        </p>
      )}

      <CancelChoiceFields choice={choice.value} choices={choices} onChoiceChange={setPicked} />

      <CancelFormFooter choice={choice.value} pending={pending}>
        {result?.status === "failed" && (
          <p className="text-destructive-text text-sm" role="alert">
            {t("We couldn't cancel your subscription. Try again or email hello@zoonk.com.")}
          </p>
        )}

        {result?.status === "unavailable" && (
          <p className="text-sm" role="alert">
            {t("That option isn't available anymore. Check your choice above and try again.")}
          </p>
        )}
      </CancelFormFooter>
    </form>
  );
}
