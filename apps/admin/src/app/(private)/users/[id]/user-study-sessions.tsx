import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import {
  type UserStudySession,
  listUserStudySessions,
} from "@/data/users/list-user-study-sessions";
import { formatDate, toWords } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";

/** What learners call each part of a day. */
const BLOCK_LABELS: Record<UserStudySession["blocks"][number]["kind"], string> = {
  checkpoint: "Test",
  learn: "Lesson",
  practice: "Practice",
  produce: "Writing or speaking",
  review: "Review",
};

/** "Review, Lesson ×5, Practice": each kind once, in the day's order. */
function describeBlocks(blocks: UserStudySession["blocks"]): string {
  const counts = Map.groupBy(blocks, (block) => block.kind);

  return [...counts]
    .map(([kind, rows]) =>
      rows.length > 1 ? `${BLOCK_LABELS[kind]} ×${rows.length}` : BLOCK_LABELS[kind],
    )
    .join(", ");
}

function SessionRow({ session, showGoal }: { session: UserStudySession; showGoal: boolean }) {
  const done = session.blocks.filter((block) => block.status === "completed").length;

  return (
    <AdminTableRow>
      <TableCell>{formatDate(session.localDate)}</TableCell>
      {showGoal ? <TableCell className="min-w-40">{session.goal?.title ?? "—"}</TableCell> : null}
      <TableCell>
        {toWords(session.status)}
        {session.freshStart ? (
          <span className="text-muted-foreground"> · {toWords(session.freshStart)}</span>
        ) : null}
      </TableCell>
      <TableCell numeric>{session.plannedMinutes} min</TableCell>
      <TableCell numeric>
        {done} <span className="font-sans">of</span> {session.blocks.length}
      </TableCell>
      <TableCell className="text-muted-foreground min-w-48 whitespace-normal">
        {describeBlocks(session.blocks) || "—"}
      </TableCell>
    </AdminTableRow>
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
    { align: "right", label: "Time planned" },
    { align: "right", label: "Parts done" },
    { fill: true, label: "Parts" },
  ];

  return (
    <AdminSection title="Recent days">
      <AdminTableColumns
        columns={columns}
        emptyLabel="No study days yet."
        isEmpty={sessions.length === 0}
      >
        {sessions.map((session) => (
          <SessionRow key={session.id} session={session} showGoal={showGoal} />
        ))}
      </AdminTableColumns>
    </AdminSection>
  );
}
