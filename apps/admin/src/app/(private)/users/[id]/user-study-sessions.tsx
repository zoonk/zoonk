import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { StateMark } from "@/components/state-mark";
import {
  type UserStudySession,
  listUserStudySessions,
} from "@/data/users/list-user-study-sessions";
import { formatDate, toWords } from "@/lib/format";
import { type DayMeterPart, DaySegment } from "@zoonk/learn/day-segments";
import { MeterParts } from "@zoonk/ui/components/meter";
import { TableCell } from "@zoonk/ui/components/table";

type Block = UserStudySession["blocks"][number];

/** What learners call each part of a day. */
const BLOCK_LABELS: Record<Block["kind"], string> = {
  checkpoint: "Test",
  learn: "Lesson",
  practice: "Practice",
  produce: "Writing or speaking",
  review: "Review",
};

const SEGMENT_STATES: Partial<Record<Block["status"], DayMeterPart["state"]>> = {
  active: "current",
  completed: "done",
  pending: "ahead",
};

/** "Review, Lesson ×5, Practice": each kind once, in the day's order. */
function describeBlocks(blocks: Block[]): string {
  const counts = Map.groupBy(blocks, (block) => block.kind);

  return [...counts]
    .map(([kind, rows]) =>
      rows.length > 1 ? `${BLOCK_LABELS[kind]} ×${rows.length}` : BLOCK_LABELS[kind],
    )
    .join(", ");
}

/** The day as the learner's Today page draws it: a part per block, a skipped one left out. */
function toMeterParts(blocks: Block[]): DayMeterPart[] {
  return blocks.flatMap((block, index) => {
    const state = SEGMENT_STATES[block.status];
    return state ? [{ id: index, state }] : [];
  });
}

function SessionRow({
  detailed,
  session,
  showGoal,
}: {
  detailed: boolean;
  session: UserStudySession;
  showGoal: boolean;
}) {
  const done = session.blocks.filter((block) => block.status === "completed").length;
  const parts = toMeterParts(session.blocks);
  const words = describeBlocks(session.blocks);

  return (
    <AdminTableRow>
      <TableCell className="text-foreground">{formatDate(session.localDate)}</TableCell>
      {showGoal ? <TableCell className="min-w-40">{session.goal?.title ?? "—"}</TableCell> : null}
      <TableCell>
        <StateMark state={session.status} />
        {session.freshStart ? (
          <span className="text-muted-foreground"> · {toWords(session.freshStart)}</span>
        ) : null}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-3">
          {/* The learner's own meter leaves out a day of one part; here every day draws its parts,
              so a column of days compares. */}
          <MeterParts
            aria-hidden={false}
            aria-label={words}
            as="span"
            className="w-32 shrink-0"
            role="img"
            title={words}
          >
            {parts.map((part) => (
              <DaySegment key={part.id} state={part.state} />
            ))}
          </MeterParts>
          <span className="text-foreground font-mono text-xs tabular-nums">
            {done} <span className="font-sans">of</span> {session.blocks.length}
          </span>
        </span>
      </TableCell>
      {detailed ? <TableCell className="whitespace-normal">{words || "—"}</TableCell> : null}
      <TableCell numeric>{session.plannedMinutes} min</TableCell>
    </AdminTableRow>
  );
}

/** The days of the Overview: enough to see whether they're studying this week. */
export const OVERVIEW_DAYS = 5;

/**
 * Their last days of study. The Overview shows a few (`limit`), each as its meter; the Learning tab
 * lists them all and says each day's parts in words.
 */
export async function UserStudySessions({ limit, userId }: { limit?: number; userId: string }) {
  "use cache: private";

  const all = await listUserStudySessions(userId);
  const sessions = limit ? all.slice(0, limit) : all;
  const showGoal = new Set(sessions.map((session) => session.goal?.id)).size > 1;
  const detailed = !limit;

  const columns: AdminTableColumn[] = [
    { label: "Day" },
    ...(showGoal ? [{ label: "Goal" }] : []),
    { label: "State", size: "wide" },
    { fill: !detailed, label: "Progress", size: "text" },
    ...(detailed ? [{ fill: true, label: "Parts" }] : []),
    { align: "right", label: "Time planned" },
  ];

  return (
    <AdminSection title="Recent days">
      <AdminTableColumns
        columns={columns}
        emptyLabel="No study days yet."
        isEmpty={sessions.length === 0}
      >
        {sessions.map((session) => (
          <SessionRow detailed={detailed} key={session.id} session={session} showGoal={showGoal} />
        ))}
      </AdminTableColumns>
    </AdminSection>
  );
}
