import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { type ListedPrompt } from "@/data/prompts/list-prompts";
import { formatDate } from "@/lib/format";
import { Badge } from "@zoonk/ui/components/badge";
import { TableCell } from "@zoonk/ui/components/table";
import Link from "next/link";
import {
  getPromptLearnerEmail,
  getPromptLearnerLabel,
  getPromptOutcomeVariant,
  getReadingSummary,
  parsePromptReading,
  promptOutcomeLabels,
} from "./_utils/prompt-labels";

function PromptReadingCell({ prompt }: { prompt: ListedPrompt }) {
  const summary = getReadingSummary(parsePromptReading(prompt.understanding));

  if (!summary) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <>
      <span className="line-clamp-2">{summary.text}</span>
      <span className="text-muted-foreground block text-xs capitalize">{summary.label}</span>
    </>
  );
}

function PromptOutcomeCell({ prompt }: { prompt: ListedPrompt }) {
  const inactiveStatuses = prompt.goals.flatMap((goal) =>
    goal.status === "active" ? [] : [goal.status],
  );

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={getPromptOutcomeVariant(prompt.outcome)}>
        {promptOutcomeLabels[prompt.outcome]}
      </Badge>
      {inactiveStatuses.length > 0 && (
        <span className="text-muted-foreground text-xs capitalize">
          {inactiveStatuses.join(", ")}
        </span>
      )}
    </div>
  );
}

export function PromptRow({ prompt }: { prompt: ListedPrompt }) {
  const { user } = prompt;
  const email = getPromptLearnerEmail(user);

  return (
    <AdminTableRow>
      <TableCell className="max-w-80 min-w-64 whitespace-normal">
        <AdminTableRowLink className="font-medium" href={`/prompts/${prompt.id}`} prefetch>
          <span className="line-clamp-2">{prompt.prompt}</span>
        </AdminTableRowLink>
      </TableCell>
      <TableCell className="max-w-56 min-w-36 whitespace-normal">
        <PromptOutcomeCell prompt={prompt} />
      </TableCell>
      <TableCell className="max-w-72 min-w-56 whitespace-normal">
        <PromptReadingCell prompt={prompt} />
      </TableCell>
      <TableCell className="max-w-48 min-w-40">
        <Link className="block hover:underline" href={`/users/${user.id}`}>
          <span className="block truncate font-medium">{getPromptLearnerLabel(user)}</span>
          {email && <span className="text-muted-foreground block truncate text-xs">{email}</span>}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">{prompt.language}</TableCell>
      <TableCell className="text-muted-foreground">
        <time dateTime={prompt.createdAt.toISOString()}>{formatDate(prompt.createdAt)}</time>
      </TableCell>
    </AdminTableRow>
  );
}
