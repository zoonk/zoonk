import { AdminSection, AdminSectionEmpty, AdminSectionSkeleton } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import {
  type LiveCallConnectionRow,
  type LiveCallControls,
  getLiveCallControls,
} from "@/data/live-calls/get-live-call-controls";
import { formatUsd } from "@/lib/ai-format";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@zoonk/ui/components/badge";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";
import { EmergencyStop } from "./emergency-stop";
import { LiveCallAdmissionForm } from "./live-call-admission-form";

const MICROS_PER_DOLLAR = 1_000_000;
const SHORT_ID_LENGTH = 8;

const columns: AdminTableColumn[] = [
  { label: "Learner" },
  { label: "State" },
  { label: "Deadline" },
  { align: "right", label: "Close attempts" },
  { align: "right", label: "Cost so far" },
  { label: "Provider session" },
  { label: "Note" },
];

const stateLabels: Record<LiveCallConnectionRow["state"], string> = {
  active: "Active",
  closed: "Closed",
  closing: "Closing",
  creating: "Creating",
  pending: "Reserved",
};

const endReasonLabels: Record<NonNullable<LiveCallConnectionRow["endReason"]>, string> = {
  admin: "Closing: admin",
  completion: "Closing: learner ended",
  deadline: "Closing: deadline",
  expired: "Closing: reservation expired",
  reconnect: "Closing: reconnect",
  takeover: "Closing: another call took over",
  timerFailed: "Closing: deadline timer failed",
};

/** The one thing worth knowing about a row, the exhausted retries first. */
function ConnectionNote({ connection }: { connection: LiveCallConnectionRow }) {
  if (connection.recoveryUnconfirmedAt) {
    return (
      <span className="text-destructive-text">
        Close retries ran out {formatDateTime(connection.recoveryUnconfirmedAt)}
      </span>
    );
  }

  return connection.endReason ? <span>{endReasonLabels[connection.endReason]}</span> : null;
}

/**
 * Core decides both marks: past its deadline, or past it long enough that new calls are refused
 * until it closes. Red is kept for the second.
 */
function DeadlineBadge({ connection }: { connection: LiveCallConnectionRow }) {
  if (connection.cleanupBlocking) {
    return <Badge variant="destructive">Blocks new calls</Badge>;
  }

  return connection.overdue ? <Badge variant="outline">Past deadline</Badge> : null;
}

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
          <DeadlineBadge connection={connection} />
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {formatDateTime(connection.deadlineAt)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{connection.closeAttempts}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatUsd(connection.liabilityMicros / MICROS_PER_DOLLAR)}
        <span className="text-muted-foreground ms-1.5 text-xs">{connection.costConfidence}</span>
      </TableCell>
      <TableCell className="font-mono text-xs">{connection.providerSessionId ?? "None"}</TableCell>
      <TableCell className="max-w-72 text-xs whitespace-normal">
        <ConnectionNote connection={connection} />
      </TableCell>
    </TableRow>
  );
}

/**
 * Why a new call can be refused as paused whatever the switch says: the API has no provider key,
 * or a connection past its deadline hasn't confirmed closing (core's check covers every connection,
 * not only the rows listed below).
 */
function AdmissionHealth({ controls }: { controls: LiveCallControls }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {controls.providerAvailable ? (
        <li className="text-muted-foreground">The API has its provider key.</li>
      ) : (
        <li className="text-destructive-text">
          The API has no provider key, so every new call is refused as paused.
        </li>
      )}

      {controls.cleanupHealthy ? null : (
        <li className="text-destructive-text">
          New calls are refused as paused while a connection past its deadline hasn’t confirmed
          closing. Its row says “Blocks new calls”.
        </li>
      )}
    </ul>
  );
}

/**
 * The switch, the emergency stop and the connections that aren't confirmed closed, read once
 * through the API so all three agree.
 */
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
        description="Read fresh when each call is reserved. Open calls keep running when you turn it off."
        title="Admission"
      >
        <div className="flex flex-col gap-5">
          <AdmissionHealth controls={controls} />
          <LiveCallAdmissionForm
            admission={controls.setting.admission}
            freeDailyBudgetMicros={controls.setting.freeDailyBudgetMicros}
          />
        </div>
      </AdminSection>

      <AdminSection
        description="Turns new calls off, then asks the provider to close one batch of open connections. Run it again while some remain."
        title="Emergency stop"
      >
        <EmergencyStop />
      </AdminSection>

      <AdminSection
        description="Connections the provider hasn't confirmed closed, earliest deadline first (up to 100)."
        title="Open connections"
      >
        <AdminTableColumns
          columns={columns}
          emptyLabel="No open connections."
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

/** Holds the three sections' places while the API answers. */
export function LiveCallSectionsSkeleton() {
  return (
    <>
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
    </>
  );
}
