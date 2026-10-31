"use client";

import { useRouter } from "@/i18n/navigation";
import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { useFormatter } from "@zoonk/learn/formatter";
import { Button } from "@zoonk/ui/components/button";
import { formatPrice } from "@zoonk/utils/currency";
import { Loader2Icon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { createContext, use, useState, useTransition } from "react";
import { type CancelPlusResult, cancelPlusAction } from "./cancel-plus-action";

type Receipt = Extract<CancelPlusResult, { status: "canceled" }> & { withdrawn: boolean };
type Outcome = Receipt | Exclude<CancelPlusResult, { status: "canceled" }>;

const CancelPlusContext = createContext<{
  cancel: (withdraw: boolean) => void;
  choice: boolean | null;
  pending: boolean;
}>({ cancel: () => null, choice: null, pending: false });

function CancelPlusReceipt({ email, receipt }: { email: string; receipt: Receipt }) {
  const t = useExtracted();
  const format = useFormatter();
  const locale = useLocale();
  const { withdrawn } = receipt;
  const endsNow = receipt.endsAt <= receipt.receivedAt;
  const date = format.dateTime(receipt.endsAt, { dateStyle: "long" });

  const dateTime = format.dateTime(receipt.receivedAt, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    timeZoneName: "short",
    year: "numeric",
  });

  const amount =
    receipt.refund && formatPrice(receipt.refund.amount, receipt.refund.currency, locale);

  return (
    <div className="flex flex-col gap-2 text-sm" role="status">
      <p className="font-medium">
        {endsNow ? t("Plus has ended.") : t("You keep Plus until {date}, then it ends.", { date })}
      </p>

      {amount && (
        <p>
          {withdrawn
            ? t(
                "We've refunded the full {amount} to the payment method you used. Your bank usually shows it within 5 to 10 business days.",
                { amount },
              )
            : t(
                "We've refunded {amount} for the months that haven't started to the payment method you used. Your bank usually shows it within 5 to 10 business days.",
                { amount },
              )}
        </p>
      )}

      {receipt.refundableUntil && (
        <p>
          {t("Changed your mind? Until {date}, you can still get a full refund.", {
            date: format.dateTime(receipt.refundableUntil, { dateStyle: "long" }),
          })}
        </p>
      )}

      <p className="text-muted-foreground">
        {withdrawn
          ? t({
              description:
                "The 14-day withdrawal from the contract (EU right of withdrawal), with its full refund.",
              message:
                "We received your withdrawal on {dateTime} and emailed the confirmation to {email}.",
              values: { dateTime, email },
            })
          : t(
              "We received your cancellation on {dateTime} and emailed the confirmation to {email}.",
              { dateTime, email },
            )}
      </p>
    </div>
  );
}

export function CancelPlusForm({ children, email }: { children: React.ReactNode; email: string }) {
  const t = useExtracted();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<boolean | null>(null);
  const [result, setResult] = useState<Outcome | null>(null);

  const cancel = (withdraw: boolean) => {
    setChoice(withdraw);

    startTransition(async () => {
      const outcome = await noteAppWrite(cancelPlusAction({ locale, withdraw })).catch(
        (): CancelPlusResult => ({ status: "failed" }),
      );

      setResult(outcome.status === "canceled" ? { ...outcome, withdrawn: withdraw } : outcome);

      // A refund still open after stopping the renewal stays on the page, read again without the
      // renewal choice.
      if (
        outcome.status === "unavailable" ||
        (outcome.status === "canceled" && outcome.refundableUntil)
      ) {
        router.refresh();
      }
    });
  };

  const receipt = result?.status === "canceled" ? result : null;

  return (
    <CancelPlusContext value={{ cancel, choice, pending }}>
      {receipt && <CancelPlusReceipt email={email} receipt={receipt} />}
      {(!receipt || receipt.refundableUntil) && children}

      {result?.status === "failed" && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("We couldn't cancel your subscription. Try again or email hello@zoonk.com.")}
        </p>
      )}

      {result?.status === "unavailable" && (
        <p className="text-sm" role="alert">
          {t("That option isn't available anymore.")}
        </p>
      )}
    </CancelPlusContext>
  );
}

export function CancelPlusButton({
  children,
  withdraw,
}: {
  children: React.ReactNode;
  withdraw: boolean;
}) {
  const { cancel, choice, pending } = use(CancelPlusContext);
  const loading = pending && choice === withdraw;

  return (
    <Button
      aria-busy={loading}
      disabled={pending}
      onClick={() => cancel(withdraw)}
      size="sm"
      type="button"
      variant="outline"
    >
      {loading && <Loader2Icon aria-hidden="true" className="animate-spin" />}
      {children}
    </Button>
  );
}
