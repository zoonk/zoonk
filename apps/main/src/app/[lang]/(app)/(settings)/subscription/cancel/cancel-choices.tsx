"use client";

import {
  type WebPlusCancellationChoice,
  type WebPlusCancellationRequest,
  webPlusCancellationRequestSchema,
} from "@zoonk/core/subscriptions/web-plus-cancellation-contract";
import { ChoiceRows, type RowChoice } from "@zoonk/learn/choice-rows";
import { useFormatter } from "@zoonk/learn/formatter";
import { PageSectionFooter } from "@zoonk/learn/page";
import { Button } from "@zoonk/ui/components/button";
import { Textarea } from "@zoonk/ui/components/textarea";
import { Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useId } from "react";

export type CancelChoice = RowChoice<WebPlusCancellationChoice>;

/** The footer's withdrawal link opens the page with the withdrawal already picked. */
export function useLinkedChoice(): WebPlusCancellationChoice | null {
  const linked = useSearchParams().get("choice");
  return webPlusCancellationRequestSchema.shape.choice.safeParse(linked).data ?? null;
}

export function CancelChoiceFields({
  choice,
  choices,
  onChoiceChange,
}: {
  choice: WebPlusCancellationChoice;
  choices: readonly CancelChoice[];
  onChoiceChange: (choice: WebPlusCancellationChoice) => void;
}) {
  const t = useExtracted();
  const reasonId = useId();
  const reasonHintId = useId();

  return (
    <>
      <ChoiceRows
        choices={choices}
        label={t("Choose how to cancel")}
        numberKeys={false}
        onChange={onChoiceChange}
        stackOnPhone={false}
        value={choice}
      />

      {choice === "extraordinary" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor={reasonId}>
            {t({
              description: "Label for why the subscription ends now, in a legal cancellation form",
              message: "Reason",
            })}
          </label>
          <p className="text-muted-foreground text-xs" id={reasonHintId}>
            {t("Briefly, why you can't keep Plus until the end of the period.")}
          </p>
          <Textarea
            aria-describedby={reasonHintId}
            id={reasonId}
            maxLength={1000}
            name="reason"
            required
          />
        </div>
      )}
    </>
  );
}

function ConfirmCancelButton({
  choice,
  pending,
}: {
  choice: WebPlusCancellationChoice;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <Button aria-busy={pending} disabled={pending} size="sm" type="submit">
      {pending && <Loader2Icon aria-hidden="true" className="animate-spin" />}
      {choice === "withdrawal"
        ? t({
            description:
              "Confirms withdrawing from the contract with a full refund. Use the official wording of the EU Consumer Rights Directive (art. 11a) in this language: in German exactly “Widerruf bestätigen”, in French “Confirmer la rétractation”, in Spanish “Confirmar desistimiento”, in Portuguese “Confirmar retratação”, in Italian “Conferma recesso”, in Polish “Potwierdź odstąpienie od umowy”.",
            message: "Confirm withdrawal",
          })
        : t({
            description:
              "Confirms canceling the subscription, at the end of the period or now for an important reason. In German it must read exactly “Jetzt kündigen” (BGB § 312k).",
            message: "Cancel now",
          })}
    </Button>
  );
}

export function CancelFormFooter({
  children,
  choice,
  pending,
}: {
  children?: React.ReactNode;
  choice: WebPlusCancellationChoice;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <div className="flex flex-col items-end gap-2 border-t pt-3">
      <PageSectionFooter>{t("We'll email you the confirmation.")}</PageSectionFooter>
      {children}
      <ConfirmCancelButton choice={choice} pending={pending} />
    </div>
  );
}

export function ReceiptDetails({
  choiceLabel,
  email,
  name,
  reason,
  receivedAt,
}: {
  choiceLabel: string;
  email?: string;
  name?: string;
  reason: string | null;
  receivedAt: Date;
}) {
  const t = useExtracted();
  const format = useFormatter();

  const received = format.dateTime(receivedAt, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    timeZoneName: "short",
    year: "numeric",
  });

  const rows = [
    ...(name ? [[t("Name"), name]] : []),
    ...(email ? [[t("Email"), email]] : []),
    [t("Request"), choiceLabel],
    ...(reason
      ? [
          [
            t({
              description: "Label for why the subscription ends now, in a legal cancellation form",
              message: "Reason",
            }),
            reason,
          ],
        ]
      : []),
    [t("Received"), received],
  ];

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
      {rows.map(([label, value]) => (
        <div className="contents" key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="wrap-break-word whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function readFormField(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value : "";
}

export function readCancellationRequest(
  choice: WebPlusCancellationChoice,
  form: HTMLFormElement,
): WebPlusCancellationRequest {
  return choice === "extraordinary"
    ? { choice, reason: readFormField(form, "reason") }
    : { choice };
}
