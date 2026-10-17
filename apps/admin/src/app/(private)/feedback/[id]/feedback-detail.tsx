import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { getContentFeedback } from "@/data/feedback/get-content-feedback";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  feedbackContentKindLabels,
  formatFeedbackReasons,
  getLearnerLabel,
} from "../_utils/feedback-labels";
import { FeedbackVoteBadge } from "../feedback-vote-badge";

/** The comment is personal data: it stays collapsed until an admin chooses to read it. */
function FeedbackComment({ comment }: { comment: string | null }) {
  if (!comment) {
    return <AdminSectionEmpty>No comment.</AdminSectionEmpty>;
  }

  return (
    <details className="text-sm">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer select-none">
        Show comment (personal data)
      </summary>
      <p className="mt-2 max-w-3xl leading-relaxed wrap-break-word whitespace-pre-wrap">
        {comment}
      </p>
    </details>
  );
}

export async function FeedbackDetail({ id }: { id: string }) {
  const feedback = await getContentFeedback(id);

  if (!feedback) {
    notFound();
  }

  const kindLabel = feedbackContentKindLabels[feedback.contentKind];

  return (
    <>
      <AdminSection title="Vote">
        <dl className="divide-y">
          <DetailField label="Content">
            {feedback.contentHref ? (
              <Link className="hover:underline" href={feedback.contentHref} prefetch>
                {kindLabel}
              </Link>
            ) : (
              kindLabel
            )}
          </DetailField>
          <DetailField label="Content id">
            <span className="font-mono text-xs">{feedback.contentId}</span>
          </DetailField>
          <DetailField label="Vote">
            <FeedbackVoteBadge vote={feedback.vote} />
          </DetailField>
          <DetailField label="Reasons">{formatFeedbackReasons(feedback.reasons)}</DetailField>
          <DetailField label="Language">{feedback.language ?? "—"}</DetailField>
          <DetailField label="Learner">
            <Link className="hover:underline" href={`/users/${feedback.user.id}`} prefetch>
              {getLearnerLabel(feedback.user)}
            </Link>
          </DetailField>
          <DetailField label="Voted">{formatDateTime(feedback.createdAt)}</DetailField>
          <DetailField label="Updated">{formatDateTime(feedback.updatedAt)}</DetailField>
        </dl>
      </AdminSection>

      <AdminSection
        description="The model, prompt version and run behind the content when the learner voted."
        title="Provenance"
      >
        <ProvenanceFields provenance={feedback} />
      </AdminSection>

      <AdminSection title="Comment">
        <FeedbackComment comment={feedback.comment} />
      </AdminSection>
    </>
  );
}
