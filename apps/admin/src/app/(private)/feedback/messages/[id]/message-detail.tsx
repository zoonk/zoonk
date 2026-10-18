import { AdminSection } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { getFeedbackMessage } from "@/data/feedback/get-feedback-message";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { feedbackContentKindLabels } from "../../_utils/feedback-labels";
import { MessageSender } from "../message-sender";
import { MessageStatusBadge } from "../message-status-badge";
import { MessageStatusForm } from "./message-status-form";

type FeedbackMessage = NonNullable<Awaited<ReturnType<typeof getFeedbackMessage>>>;

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

function MessageContext({ message }: { message: FeedbackMessage }) {
  const { context } = message;

  return (
    <AdminSection title="Context">
      <dl className="divide-y">
        <DetailField label="Screen">{context.screen ?? "—"}</DetailField>
        <DetailField label="URL">
          <span className="font-mono text-xs break-all">{context.url ?? "—"}</span>
        </DetailField>
        <DetailField label="Platform">{context.platform ?? "—"}</DetailField>
        <DetailField label="App version">{context.appVersion ?? "—"}</DetailField>
        <DetailField label="Content">
          <MessageContent message={message} />
        </DetailField>
        <DetailField label="Content id">
          <span className="font-mono text-xs">{context.contentId ?? "—"}</span>
        </DetailField>
      </dl>

      {context.provenance ? (
        <div className="mt-4">
          <ProvenanceFields provenance={context.provenance} />
        </div>
      ) : null}
    </AdminSection>
  );
}

export async function MessageDetail({ id }: { id: string }) {
  const message = await getFeedbackMessage(id);

  if (!message) {
    notFound();
  }

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Message</h1>
          <p className="text-muted-foreground text-sm">Sent {formatDateTime(message.createdAt)}</p>
        </div>
        <MessageStatusBadge status={message.status} />
      </header>

      <AdminSection
        action={<MessageStatusForm currentStatus={message.status} messageId={message.id} />}
        title="Message"
      >
        <p className="max-w-3xl leading-7 wrap-break-word whitespace-pre-wrap">{message.message}</p>
      </AdminSection>

      <AdminSection title="Sender">
        <MessageSender email={message.email} user={message.user} />
      </AdminSection>

      <MessageContext message={message} />
    </>
  );
}
