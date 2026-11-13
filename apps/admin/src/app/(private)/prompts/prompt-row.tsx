import { AdminNameCell } from "@/components/admin-name-cell";
import { AdminTableRow } from "@/components/admin-table-row";
import { AdminUserCell } from "@/components/admin-user-cell";
import { GoalKindIcon } from "@/components/goal-kind-icon";
import { StateMark } from "@/components/state-mark";
import { type ListedPrompt } from "@/data/prompts/list-prompts";
import { formatDate, toWords } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { TableCell } from "@zoonk/ui/components/table";
import {
  getReadingSummary,
  parsePromptReading,
  promptOutcomeLabels,
  promptOutcomeTones,
} from "./_utils/prompt-labels";

/** What Zoonk made of the words: the goal's name over its kind, with the kind's icon. */
function PromptReadingCell({ prompt }: { prompt: ListedPrompt }) {
  const summary = getReadingSummary(parsePromptReading(prompt.understanding));

  if (!summary) {
    return null;
  }

  return (
    <span className="flex min-w-0 items-start gap-2.5">
      {summary.kind ? (
        <span className="flex h-5 shrink-0 items-center">
          <GoalKindIcon kind={summary.kind} />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="text-foreground block truncate">{summary.text}</span>
        <span className="block truncate text-xs">{summary.label}</span>
      </span>
    </span>
  );
}

/** A goal that was created and then archived or deleted says so under the outcome. */
function PromptOutcomeCell({ prompt }: { prompt: ListedPrompt }) {
  const inactive = prompt.goals.flatMap((goal) => (goal.status === "active" ? [] : [goal.status]));

  return (
    <>
      <StateMark state={prompt.outcome} tone={promptOutcomeTones[prompt.outcome]}>
        {promptOutcomeLabels[prompt.outcome]}
      </StateMark>
      {inactive.length > 0 ? (
        <span className="block text-xs">
          Now {inactive.map((status) => toWords(status).toLowerCase()).join(", ")}
        </span>
      ) : null}
    </>
  );
}

export function PromptRow({ prompt }: { prompt: ListedPrompt }) {
  return (
    <AdminTableRow>
      <AdminNameCell
        href={`/prompts/${prompt.id}`}
        note={languageName(prompt.language)}
        title={prompt.prompt}
      />
      <TableCell>
        <PromptReadingCell prompt={prompt} />
      </TableCell>
      <TableCell>
        <PromptOutcomeCell prompt={prompt} />
      </TableCell>
      <AdminUserCell opensRow={false} user={prompt.user} userId={prompt.user.id} />
      <TableCell>{formatDate(prompt.createdAt)}</TableCell>
    </AdminTableRow>
  );
}
