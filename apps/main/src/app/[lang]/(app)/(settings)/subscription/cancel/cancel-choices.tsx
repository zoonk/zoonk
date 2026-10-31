"use client";

import {
  type WebPlusCancellationChoice,
  type WebPlusCancellationRequest,
  webPlusCancellationRequestSchema,
} from "@zoonk/core/subscriptions/web-plus-cancellation-contract";
import { ChoiceRows, type RowChoice } from "@zoonk/learn/choice-rows";
import { PageSectionFooter } from "@zoonk/learn/page";
import { Button } from "@zoonk/ui/components/button";
import { Textarea } from "@zoonk/ui/components/textarea";
import { Loader2Icon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";

export type CancelChoice = RowChoice<WebPlusCancellationChoice>;

const CANCEL_REVIEW_ID = "cancel-review";

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

function ConfirmCancelLabel({ choice }: { choice: WebPlusCancellationChoice }) {
  const t = useExtracted();

  return choice === "withdrawal"
    ? t({
        description:
          "Confirms withdrawing from the contract with a full refund. Use the official wording of the EU Consumer Rights Directive (art. 11a) in this language: in German exactly “Widerruf bestätigen”, in French “Confirmer la rétractation”, in Spanish “Confirmar desistimiento”, in Portuguese “Confirmar retratação”, in Italian “Conferma recesso”, in Polish “Potwierdź odstąpienie od umowy”.",
        message: "Confirm withdrawal",
      })
    : t({
        description:
          "Confirms canceling the subscription, at the end of the period or now for an important reason. In German it must read exactly “Jetzt kündigen” (BGB § 312k).",
        message: "Cancel now",
      });
}

/** France's last step sends a cancellation as “Notifier la résiliation” (Code de la consommation D215-3). */
function NotifyCancellationLabel({ choice }: { choice: WebPlusCancellationChoice }) {
  const t = useExtracted();

  return choice === "withdrawal" ? (
    <ConfirmCancelLabel choice={choice} />
  ) : (
    t({
      description:
        "Sends the cancellation from its summary page, as French law asks (Code de la consommation D215-3). In French it must read exactly “Notifier la résiliation”.",
      message: "Notify cancellation",
    })
  );
}

function PendingIcon({ pending }: { pending: boolean }) {
  return pending && <Loader2Icon aria-hidden="true" className="animate-spin" />;
}

/** With `reviewFirst`, the button leads to the summary instead of sending. */
export function CancelFormFooter({
  children,
  choice,
  pending,
  reviewFirst,
}: {
  children?: React.ReactNode;
  choice: WebPlusCancellationChoice;
  pending: boolean;
  reviewFirst: boolean;
}) {
  const t = useExtracted();

  return (
    <div className="flex flex-col items-end gap-2 border-t pt-3">
      <PageSectionFooter>{t("We'll email you the confirmation.")}</PageSectionFooter>
      {children}
      <Button aria-busy={pending} disabled={pending} size="sm" type="submit">
        <PendingIcon pending={pending} />
        {reviewFirst ? t("Continue") : <ConfirmCancelLabel choice={choice} />}
      </Button>
    </div>
  );
}

/**
 * France's summary of the request before it's sent, which the learner can still change
 * (Code de la consommation L215-1-1 and D215-3).
 */
export function CancelReview({
  children,
  choice,
  details,
  onConfirm,
  onEdit,
  pending,
}: {
  children?: React.ReactNode;
  choice: WebPlusCancellationChoice;
  details: React.ReactNode;
  onConfirm: () => void;
  onEdit: () => void;
  pending: boolean;
}) {
  const t = useExtracted();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby={CANCEL_REVIEW_ID} className="flex flex-col gap-4 text-sm">
      <h2 className="font-medium outline-none" id={CANCEL_REVIEW_ID} ref={headingRef} tabIndex={-1}>
        {t("Check your request")}
      </h2>

      {details}

      <div className="flex flex-col items-end gap-2 border-t pt-3">
        <PageSectionFooter>{t("We'll email you the confirmation.")}</PageSectionFooter>
        {children}
        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={pending} onClick={onEdit} size="sm" type="button" variant="outline">
            {t({
              description:
                "Goes back from the cancellation's summary to change it. In French it reads “Modifier”.",
              message: "Edit",
            })}
          </Button>
          <Button
            aria-busy={pending}
            disabled={pending}
            onClick={onConfirm}
            size="sm"
            type="button"
          >
            <PendingIcon pending={pending} />
            <NotifyCancellationLabel choice={choice} />
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * France's summary takes the form's place, and the form keeps its values while hidden. Going back
 * lands on the picked choice, or the form's first field.
 */
export function useCancelReview<Request>() {
  const formRef = useRef<HTMLFormElement>(null);
  const [review, setReview] = useState<Request | null>(null);

  const edit = () => {
    flushSync(() => setReview(null));
    const form = formRef.current;

    const field =
      form?.querySelector<HTMLElement>("input:checked") ??
      form?.querySelector<HTMLElement>("input, textarea, button");

    field?.focus();
  };

  return { edit, formRef, review, setReview };
}

export function ChoiceSummary({ choice }: { choice: CancelChoice }) {
  return (
    <>
      {choice.label}
      {choice.description && (
        <span className="text-muted-foreground block">{choice.description}</span>
      )}
    </>
  );
}

export function RequestDetails({
  email,
  name,
  plan,
  reason,
  receivedAt,
  request,
}: {
  email?: string;
  name?: string;
  plan?: string;
  reason: string | null;
  receivedAt?: Date;
  request: React.ReactNode;
}) {
  const t = useExtracted();
  const format = useFormatter();

  const received =
    receivedAt &&
    format.dateTime(receivedAt, {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "long",
      timeZoneName: "short",
      year: "numeric",
    });

  const reasonLabel = t({
    description: "Label for why the subscription ends now, in a legal cancellation form",
    message: "Reason",
  });

  const rows = [
    name ? { label: t("Name"), value: name } : null,
    email ? { label: t("Email"), value: email } : null,
    plan ? { label: t("Plan"), value: plan } : null,
    { label: t("Request"), value: request },
    reason ? { label: reasonLabel, value: reason } : null,
    received ? { label: t("Received"), value: received } : null,
  ].filter((row) => row !== null);

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
      {rows.map(({ label, value }) => (
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
