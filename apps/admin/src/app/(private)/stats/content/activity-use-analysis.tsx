import { AdminTableRow } from "@/components/admin-table-row";
import {
  STAT_TILES_CLASS,
  type StatChange,
  StatChangeAmount,
  StatTile,
} from "@/components/stat-tile";
import {
  type ActivityUse,
  type ActivityUseRow,
  getActivityUse,
} from "@/data/stats/get-activity-use";
import { formatCount, formatPercent, toWords } from "@/lib/format";
import { Meter, MeterFill } from "@zoonk/ui/components/meter";
import { Table, TableBody, TableCell, TableHead, TableHeader } from "@zoonk/ui/components/table";
import { BookOpenIcon, ListChecksIcon, PanelsTopLeftIcon, ShapesIcon } from "lucide-react";
import { toPercent } from "../_utils/metric-trend";
import { type StatsPeriod } from "../_utils/stats-period";

/** Activities are rare, so a share keeps a decimal: "0.4%" never rounds to "0%". */
const SHARE_DECIMALS = 1;

/** Where the learner apps name a subject other than its stored code in words. */
const SUBJECT_NAMES: Partial<Record<string, string>> = { tech: "Technology" };

type Share = { count: number; of: number; percent: number | null };

type Subject = ActivityUse["subjects"][number];

function subjectName(subject: string | null): string {
  if (subject === null) {
    return "No subject";
  }

  return SUBJECT_NAMES[subject] ?? toWords(subject);
}

function formatShare(percent: number | null): string {
  return formatPercent(percent, { decimals: SHARE_DECIMALS });
}

function shareOf(count: number, of: number): Share {
  const percent = toPercent({ denominator: of, numerator: count });
  return { count, of, percent: percent === null ? null : Number(percent.toFixed(SHARE_DECIMALS)) };
}

function sharesOf(row: ActivityUseRow) {
  return {
    activityScreens: shareOf(row.activityScreens, row.screens),
    kept: shareOf(row.keptActivities, row.plannedActivities),
    lessonsWithActivity: shareOf(row.lessonsWithActivity, row.lessons),
  };
}

/** Compared as rounded, so a change of "0 pts" never shows beside two equal shares. */
function shareChange(current: Share, previous?: Share): StatChange | undefined {
  const before = previous?.percent ?? null;

  if (current.percent === null || before === null) {
    return undefined;
  }

  return {
    by: "points",
    current: current.percent,
    fall: "watch",
    format: formatShare,
    previous: before,
    rise: "good",
  };
}

function lessonsChange(current: number, previous?: number): StatChange | undefined {
  return previous === undefined || previous === 0
    ? undefined
    : { current, format: (value) => value.toLocaleString("en"), previous };
}

/** Most lessons first, so the subjects that move the total lead; lessons outside one go last. */
function bySize(a: Subject, b: Subject): number {
  if (a.subject === null || b.subject === null) {
    return a.subject === null ? 1 : -1;
  }

  return b.lessons - a.lessons || subjectName(a.subject).localeCompare(subjectName(b.subject));
}

export async function ActivityUseAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { comparisonLabel, current, previous } = statsPeriod;

  const [now, before] = await Promise.all([
    getActivityUse(current.start, current.end),
    comparisonLabel ? getActivityUse(previous.start, previous.end) : null,
  ]);

  return (
    <section className="flex flex-col gap-8 py-4">
      <ActivityUseTiles before={before?.all} now={now.all} />

      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Lessons whose current screens were written in this period, by the subject of their course.
          {comparisonLabel ? " Arrows compare with the period before." : ""} Language-course lessons
          are left out: their writer never uses activities.
        </p>

        <SubjectTable before={before} now={now} />
      </div>
    </section>
  );
}

function ShareDetail({ share, unit }: { share: Share; unit: [one: string, many: string] }) {
  if (share.of === 0) {
    return null;
  }

  return (
    <>
      <Meter as="span" className="my-1.5">
        <MeterFill as="span" share={share.count / share.of} />
      </Meter>
      {share.count.toLocaleString("en")} of {formatCount(share.of, ...unit)}
    </>
  );
}

function ActivityUseTiles({ before, now }: { before?: ActivityUseRow; now: ActivityUseRow }) {
  const shares = sharesOf(now);
  const previous = before ? sharesOf(before) : undefined;

  return (
    <div className={STAT_TILES_CLASS}>
      <StatTile
        change={shareChange(shares.lessonsWithActivity, previous?.lessonsWithActivity)}
        detail={<ShareDetail share={shares.lessonsWithActivity} unit={["lesson", "lessons"]} />}
        icon={<ShapesIcon />}
        title="Lessons with an activity"
        value={formatShare(shares.lessonsWithActivity.percent)}
      />

      <StatTile
        change={shareChange(shares.activityScreens, previous?.activityScreens)}
        detail={<ShareDetail share={shares.activityScreens} unit={["screen", "screens"]} />}
        icon={<PanelsTopLeftIcon />}
        title="Activity screens"
        value={formatShare(shares.activityScreens.percent)}
      />

      <StatTile
        change={shareChange(shares.kept, previous?.kept)}
        detail={
          shares.kept.of === 0 ? (
            "None planned"
          ) : (
            <ShareDetail share={shares.kept} unit={["planned activity", "planned activities"]} />
          )
        }
        help="Activities the lesson's current plan asks for that its screens show, with the template the plan named. A drop usually means writing or fixing lost them; a staff plan change also counts until the lesson is rewritten."
        icon={<ListChecksIcon />}
        title="Planned activities kept"
        value={formatShare(shares.kept.percent)}
      />

      <StatTile
        change={lessonsChange(now.lessons, before?.lessons)}
        detail={formatCount(now.screens, "screen")}
        icon={<BookOpenIcon />}
        title="Lessons written"
        value={now.lessons.toLocaleString("en")}
      />
    </div>
  );
}

function SubjectTable({ before, now }: { before: ActivityUse | null; now: ActivityUse }) {
  const rows = now.subjects.toSorted(bySize);

  return (
    <Table scrollLabel="Activities by subject">
      <TableHeader>
        <AdminTableRow>
          <TableHead>Subject</TableHead>
          <TableHead numeric>Lessons</TableHead>
          <TableHead>Lessons with an activity</TableHead>
          <TableHead>Activity screens</TableHead>
        </AdminTableRow>
      </TableHeader>

      <TableBody>
        {rows.length > 0 ? (
          rows.map((row) => (
            <SubjectRow
              before={before?.subjects.find((subject) => subject.subject === row.subject)}
              key={row.subject ?? "none"}
              row={row}
            />
          ))
        ) : (
          <AdminTableRow>
            <TableCell className="text-muted-foreground" colSpan={4}>
              No lessons written in this period.
            </TableCell>
          </AdminTableRow>
        )}
      </TableBody>
    </Table>
  );
}

function SubjectRow({ before, row }: { before?: Subject; row: Subject }) {
  const shares = sharesOf(row);
  const previous = before ? sharesOf(before) : undefined;
  const change = lessonsChange(row.lessons, before?.lessons);

  return (
    <AdminTableRow>
      <TableCell className="font-medium">{subjectName(row.subject)}</TableCell>

      <TableCell numeric>
        <span className="flex flex-col items-end gap-1">
          {row.lessons.toLocaleString("en")}
          {change ? (
            <span className="font-sans text-xs">
              <StatChangeAmount change={change} />
            </span>
          ) : null}
        </span>
      </TableCell>

      <ShareCell
        change={shareChange(shares.lessonsWithActivity, previous?.lessonsWithActivity)}
        share={shares.lessonsWithActivity}
      />

      <ShareCell
        change={shareChange(shares.activityScreens, previous?.activityScreens)}
        share={shares.activityScreens}
      />
    </AdminTableRow>
  );
}

function ShareCell({ change, share }: { change?: StatChange; share: Share }) {
  return (
    <TableCell>
      <span className="flex min-w-36 flex-col gap-1.5">
        <span className="flex items-baseline gap-2">
          <span className="text-foreground text-compact font-mono">
            {formatShare(share.percent)}
          </span>
          {change ? (
            <span className="text-xs">
              <StatChangeAmount change={change} />
            </span>
          ) : null}
        </span>
        <Meter as="span">
          <MeterFill as="span" share={share.of > 0 ? share.count / share.of : 0} />
        </Meter>
        <span className="text-muted-foreground text-xs">
          {share.count.toLocaleString("en")} of {share.of.toLocaleString("en")}
        </span>
      </span>
    </TableCell>
  );
}
