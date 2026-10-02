import { ProvenanceLine } from "@/components/provenance";
import { type ListedContentFeedback } from "@/data/feedback/list-content-feedback";
import { formatDate } from "@/lib/format";
import { Badge } from "@zoonk/ui/components/badge";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";
import {
  experienceModeLabels,
  feedbackContentKindLabels,
  formatFeedbackReasons,
  getLearnerLabel,
} from "./_utils/feedback-labels";
import { FeedbackVoteBadge } from "./feedback-vote-badge";

function FeedbackContentCell({ feedback }: { feedback: ListedContentFeedback }) {
  const label = feedbackContentKindLabels[feedback.contentKind];

  if (!feedback.contentHref) {
    return <span>{label}</span>;
  }

  return (
    <Link className="font-medium hover:underline" href={feedback.contentHref} prefetch>
      {label}
    </Link>
  );
}

/**
 * One vote per row: what it was about, the verdict and reasons, and the model and prompt version
 * behind the content. Comments stay on the detail page, so the row only marks that one exists.
 */
export function FeedbackRow({ feedback }: { feedback: ListedContentFeedback }) {
  return (
    <TableRow>
      <TableCell>
        <Link className="hover:underline" href={`/feedback/${feedback.id}`} prefetch>
          {formatDate(feedback.createdAt)}
        </Link>
      </TableCell>
      <TableCell>
        <FeedbackContentCell feedback={feedback} />
      </TableCell>
      <TableCell>
        <FeedbackVoteBadge vote={feedback.vote} />
      </TableCell>
      <TableCell className="max-w-48 min-w-32 text-xs whitespace-normal">
        {formatFeedbackReasons(feedback.reasons)}
      </TableCell>
      <TableCell>{feedback.hasComment ? <Badge variant="outline">Comment</Badge> : null}</TableCell>
      <TableCell className="text-xs">
        {[feedback.language, feedback.mode && experienceModeLabels[feedback.mode]]
          .filter(Boolean)
          .join(" · ") || "—"}
      </TableCell>
      <TableCell>
        <ProvenanceLine provenance={feedback} />
      </TableCell>
      <TableCell className="max-w-48">
        <Link
          className="block truncate hover:underline"
          href={`/users/${feedback.user.id}`}
          prefetch
        >
          {getLearnerLabel(feedback.user)}
        </Link>
      </TableCell>
    </TableRow>
  );
}
