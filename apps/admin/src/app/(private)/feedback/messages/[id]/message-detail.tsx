import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { type getFeedbackMessage } from "@/data/feedback/get-feedback-message";
import { formatDateTime } from "@/lib/format";
import { type PlusCancellationRequest } from "@zoonk/core/feedback/contract";
import Link from "next/link";
import { feedbackContentKindLabels, getLearnerLabel } from "../../_utils/feedback-labels";

export type FeedbackMessage = NonNullable<Awaited<ReturnType<typeof getFeedbackMessage>>>;

function MessageContent({ message }: { message: FeedbackMessage }) {
  const { context } = message;
  const kindLabel = context.contentKind ? feedbackContentKindLabels[context.contentKind] : null;

  if (!kindLabel) {
    return "—";
  }

  if (!message.contentHref) {
    return kindLabel;
  }

  return (
    <Link className="hover:underline" href={message.contentHref} prefetch>
      {kindLabel}
    </Link>
  );
}

function MessageSenderField({ message }: { message: FeedbackMessage }) {
  if (!message.user) {
    return message.email ?? "Unknown sender";
  }

  return (
    <>
      <Link className="hover:underline" href={`/users/${message.user.id}`} prefetch>
        {getLearnerLabel(message.user)}
      </Link>
      <span className="text-muted-foreground block">{message.email ?? message.user.email}</span>
    </>
  );
}

const CANCELLATION_CHOICES: Record<PlusCancellationRequest["choice"], string> = {
  extraordinary: "End now for an important reason (refund the days left)",
  ordinary: "Cancel at the end of the period",
  withdrawal: "Withdrawal (full refund within 14 days of subscribing)",
};

/** Support acts in Stripe after confirming with the owner; a genuine request counts from its receipt. */
function PlusCancellationFields({ request }: { request: PlusCancellationRequest }) {
  return (
    <AdminSection title="Plus cancellation request">
      <DetailFields>
        <DetailField label="Received">
          <span className="font-medium">{formatDateTime(request.receivedAt)}</span>
          <span className="text-muted-foreground block font-mono text-xs">{request.receivedAt}</span>
        </DetailField>
        <DetailField label="Choice">{CANCELLATION_CHOICES[request.choice]}</DetailField>
        <DetailField label="Reason">{request.reason ?? "—"}</DetailField>
        <DetailField label="Account">
          {request.userId ? (
            <Link className="hover:underline" href={`/users/${request.userId}`} prefetch>
              Open the account
            </Link>
          ) : (
            "No account has this email"
          )}
        </DetailField>
        <DetailField label="Typed name">{request.name}</DetailField>
        <DetailField label="Typed email">{request.email}</DetailField>
      </DetailFields>
    </AdminSection>
  );
}

export function MessageDetail({ message }: { message: FeedbackMessage }) {
  const { context } = message;

  return (
    <>
      {context.plusCancellation ? <PlusCancellationFields request={context.plusCancellation} /> : null}

      <AdminSection title="Message">
        <p className="max-w-3xl leading-7 wrap-break-word whitespace-pre-wrap">{message.message}</p>
      </AdminSection>

      <AdminSection title="Details">
        <DetailFields>
          <DetailField label="Sender">
            <MessageSenderField message={message} />
          </DetailField>
          <DetailField label="Screen">{context.screen ?? "—"}</DetailField>
          <DetailField label="URL">
            <span className="break-all">{context.url ?? "—"}</span>
          </DetailField>
          <DetailField label="Platform">{context.platform ?? "—"}</DetailField>
          <DetailField label="App version">{context.appVersion ?? "—"}</DetailField>
          <DetailField label="Content">
            <MessageContent message={message} />
          </DetailField>
          <DetailField label="Content id">
            {context.contentId ? (
              <span className="font-mono text-xs">{context.contentId}</span>
            ) : (
              "—"
            )}
          </DetailField>
        </DetailFields>
      </AdminSection>

      {context.provenance ? (
        <AdminSection title="Content provenance">
          <ProvenanceFields provenance={context.provenance} />
        </AdminSection>
      ) : null}
    </>
  );
}
