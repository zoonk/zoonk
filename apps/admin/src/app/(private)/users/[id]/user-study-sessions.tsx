import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import {
  type UserStudySession,
  listUserStudySessions,
} from "@/data/users/list-user-study-sessions";
import { formatDate, toWords } from "@/lib/format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";

/** "Review, Learn ×5, Practice": each kind once, in the session's order. */
function describeBlocks(blocks: UserStudySession["blocks"]): string {
  const counts = Map.groupBy(blocks, (block) => block.kind);

  return [...counts]
    .map(([kind, rows]) => (rows.length > 1 ? `${toWords(kind)} ×${rows.length}` : toWords(kind)))
    .join(", ");
}

function SessionRow({ session, showGoal }: { session: UserStudySession; showGoal: boolean }) {
  const done = session.blocks.filter((block) => block.status === "completed").length;

  return (
    <TableRow>
      <TableCell>{formatDate(session.localDate)}</TableCell>
      {showGoal ? <TableCell className="min-w-40">{session.goal?.title ?? "—"}</TableCell> : null}
      <TableCell>
        {toWords(session.status)}
        {session.freshStart ? (
          <span className="text-muted-foreground"> · {toWords(session.freshStart)}</span>
        ) : null}
      </TableCell>
      <TableCell className="text-right tabular-nums">{session.plannedMinutes} min</TableCell>
      <TableCell className="text-right tabular-nums">
        {done} of {session.blocks.length}
      </TableCell>
      <TableCell className="text-muted-foreground min-w-48 whitespace-normal">
        {describeBlocks(session.blocks) || "—"}
      </TableCell>
    </TableRow>
  );
}

export async function UserStudySessions({ userId }: { userId: string }) {
  "use cache: private";

  const sessions = await listUserStudySessions(userId);
  const showGoal = new Set(sessions.map((session) => session.goal?.id)).size > 1;

  const columns: AdminTableColumn[] = [
    { label: "Day" },
    ...(showGoal ? [{ label: "Goal" }] : []),
    { label: "State" },
    { align: "right", label: "Planned" },
    { align: "right", label: "Done" },
    { label: "What was in it" },
  ];

  return (
    <AdminSection title="Recent sessions">
      <AdminTableColumns
        columns={columns}
        emptyLabel="No study sessions yet."
        isEmpty={sessions.length === 0}
      >
        {sessions.map((session) => (
          <SessionRow key={session.id} session={session} showGoal={showGoal} />
        ))}
      </AdminTableColumns>
    </AdminSection>
  );
}
