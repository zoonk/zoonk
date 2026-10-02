import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import {
  type UserStudySession,
  listUserStudySessions,
} from "@/data/users/list-user-study-sessions";
import { formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

function SessionRow({ session }: { session: UserStudySession }) {
  const finished = session.blocks.filter((block) => block.status === "completed").length;
  const brainPower = session.blocks.reduce((total, block) => total + block.brainPower, 0);

  return (
    <TableRow>
      <TableCell>{formatDate(session.localDate)}</TableCell>
      <TableCell className="min-w-40">{session.goal?.title ?? "—"}</TableCell>
      <TableCell className="capitalize">
        {session.status}
        {session.freshStart ? (
          <span className="text-muted-foreground text-xs"> · {session.freshStart}</span>
        ) : null}
      </TableCell>
      <TableCell className="text-right tabular-nums">{session.plannedMinutes} min</TableCell>
      <TableCell className="text-right tabular-nums">
        {finished} / {session.blocks.length}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {session.blocks.map((block) => block.kind).join(", ") || "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">{brainPower}</TableCell>
    </TableRow>
  );
}

/** The learner's latest days: what each session planned, how far they got and what it earned. */
export async function UserStudySessions({ userId }: { userId: string }) {
  "use cache: private";

  const sessions = await listUserStudySessions(userId);

  return (
    <AdminSection title="Study sessions">
      {sessions.length === 0 ? (
        <AdminSectionEmpty>No study sessions yet.</AdminSectionEmpty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead className="text-right">Blocks done</TableHead>
                <TableHead>Blocks</TableHead>
                <TableHead className="text-right">Brain Power</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminSection>
  );
}
