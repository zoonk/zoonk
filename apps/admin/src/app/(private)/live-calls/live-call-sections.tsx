import { AdminSection, AdminSectionEmpty, AdminSectionSkeleton } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import {
  type LiveCallConnectionRow,
  getLiveCallControls,
} from "@/data/live-calls/get-live-call-controls";
import { formatUsd } from "@/lib/ai-format";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@zoonk/ui/components/badge";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";
import { LiveCallAdmissionForm } from "./live-call-admission-form";

const MICROS_PER_DOLLAR = 1_000_000;
const SHORT_ID_LENGTH = 8;

const columns: AdminTableColumn[] = [
  { label: "Learner" },
  { label: "State" },
  { label: "Deadline" },
  { align: "right", label: "Cost so far" },
  { label: "Provider session" },
  { label: "Note" },
];

const stateLabels: Record<LiveCallConnectionRow["state"], string> = {
  ended: "Ended",
  live: "Live",
  reserved: "Reserved",
  starting: "Starting",
};

const endReasonLabels: Record<NonNullable<LiveCallConnectionRow["endReason"]>, string> = {
  completion: "Ending: learner finished",
  deadline: "Ending: deadline",
  failed: "Ending: creation failed",
  learner: "Ending: learner ended",
  reconnect: "Ending: reconnect",
  refused: "Ending: provider refused",
  takeover: "Ending: another call took over",
};

function ConnectionRow({ connection }: { connection: LiveCallConnectionRow }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">
        <Link className="hover:underline" href={`/users/${connection.userId}`} prefetch>
          {connection.userId.slice(0, SHORT_ID_LENGTH)}
        </Link>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1.5">
          <Badge variant="secondary">{stateLabels[connection.state]}</Badge>
          {connection.overdue ? <Badge variant="destructive">Past deadline</Badge> : null}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {formatDateTime(connection.deadlineAt)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatUsd(connection.exposureMicros / MICROS_PER_DOLLAR)}
      </TableCell>
      <TableCell className="font-mono text-xs">{connection.providerSessionId ?? "None"}</TableCell>
      <TableCell className="max-w-72 text-xs whitespace-normal">
        {connection.endReason ? endReasonLabels[connection.endReason] : null}
      </TableCell>
    </TableRow>
  );
}

/** Without the API's provider key, every new call is refused as paused whatever the switch says. */
function ProviderKey({ available }: { available: boolean }) {
  return available ? (
    <p className="text-muted-foreground text-sm">The API has its provider key.</p>
  ) : (
    <p className="text-destructive-text text-sm">
      The API has no provider key, so every new call is refused as paused.
    </p>
  );
}

export async function LiveCallSections() {
  const controls = await getLiveCallControls();

  if (!controls) {
    return (
      <AdminSectionEmpty>
        Could not reach the API. Check that it is running, then reload.
      </AdminSectionEmpty>
    );
  }

  return (
    <>
      <AdminSection
        description="Read fresh when each call is reserved and connects. Calls already live end at their deadline when you turn it off."
        title="Admission"
      >
        <div className="flex flex-col gap-5">
          <ProviderKey available={controls.providerAvailable} />
          <LiveCallAdmissionForm
            admission={controls.setting.admission}
            freeDailyBudgetMicros={controls.setting.freeDailyBudgetMicros}
          />
        </div>
      </AdminSection>

      <AdminSection
        description="Connections still open, by earliest deadline (up to 100). Cost so far is the reservation or the call's clock, whichever is more. One past its deadline means its hangup is failing; the learner's next start or End tries again."
        title="Open connections"
      >
        <AdminTableColumns
          columns={columns}
          emptyLabel="No connection is open."
          isEmpty={controls.connections.length === 0}
        >
          {controls.connections.map((connection) => (
            <ConnectionRow connection={connection} key={connection.id} />
          ))}
        </AdminTableColumns>
      </AdminSection>
    </>
  );
}

export function LiveCallSectionsSkeleton() {
  return (
    <>
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
    </>
  );
}
