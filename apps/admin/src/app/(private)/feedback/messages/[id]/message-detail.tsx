import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { type getFeedbackMessage } from "@/data/feedback/get-feedback-message";
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

export function MessageDetail({ message }: { message: FeedbackMessage }) {
  const { context } = message;

  return (
    <>
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
