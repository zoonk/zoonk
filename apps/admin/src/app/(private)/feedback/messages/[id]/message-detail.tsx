import { AdminDisclosure } from "@/components/admin-json";
import { DetailField, DetailFields } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { type getFeedbackMessage } from "@/data/feedback/get-feedback-message";
import Link from "next/link";
import { getFeedbackLearnerLabel, getFeedbackSubject } from "../../_utils/feedback-labels";

export type FeedbackMessage = NonNullable<Awaited<ReturnType<typeof getFeedbackMessage>>>;

function MessageSender({ message }: { message: FeedbackMessage }) {
  if (!message.user) {
    return message.email ?? "Unknown sender";
  }

  return (
    <>
      <Link className="underline underline-offset-3" href={`/users/${message.user.id}`} prefetch>
        {getFeedbackLearnerLabel(message.user)}
      </Link>
      <span className="text-muted-foreground"> · {message.email ?? "no reply email"}</span>
    </>
  );
}

function MessageSubject({ message }: { message: FeedbackMessage }) {
  const subject = getFeedbackSubject(message.context);

  if (!message.contentHref) {
    return subject;
  }

  return (
    <Link className="underline underline-offset-3" href={message.contentHref} prefetch>
      {subject}
    </Link>
  );
}

export function MessageDetail({ message }: { message: FeedbackMessage }) {
  const { context } = message;
  const subject = getFeedbackSubject(context);

  return (
    <>
      <p className="max-w-column text-base leading-relaxed wrap-break-word whitespace-pre-wrap">
        {message.message}
      </p>

      <div className="flex flex-col gap-3">
        <DetailFields>
          <DetailField label="From">
            <MessageSender message={message} />
          </DetailField>
          <DetailField label="About">
            <MessageSubject message={message} />
          </DetailField>
          {context.screen && context.screen !== subject ? (
            <DetailField label="Sent from">{context.screen}</DetailField>
          ) : null}
        </DetailFields>

        <AdminDisclosure label="Technical details">
          <div className="divide-y pb-2">
            <DetailFields>
              <DetailField label="URL" mono={Boolean(context.url)}>
                {context.url ?? "—"}
              </DetailField>
              <DetailField label="Content id">{context.contentId ?? "—"}</DetailField>
            </DetailFields>
            {context.provenance ? <ProvenanceFields provenance={context.provenance} /> : null}
          </div>
        </AdminDisclosure>
      </div>
    </>
  );
}
