import { AdminSectionEmpty } from "@/components/admin-section";
import { STUCK_RUNNING_MINUTES, countGenerationFailures } from "@/data/ai/get-generation-failures";
import { type InboxQueue, getInbox } from "@/data/inbox/get-inbox";
import { countMissingAudio } from "@/data/media/list-missing-audio";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { sumOf } from "@zoonk/utils/number";
import { ChevronRightIcon } from "lucide-react";
import { type Route } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

type AttentionRow = { count: number; detail: string; href: Route; title: string };

const MINUTES_PER_HOUR = 60;

function since({ oldest }: InboxQueue): string {
  return oldest ? `, the oldest from ${formatDate(oldest)}` : "";
}

async function loadAttentionRows(): Promise<AttentionRow[]> {
  const [inbox, failures, missingAudio] = await Promise.all([
    getInbox(),
    countGenerationFailures(),
    countMissingAudio(),
  ]);

  const failed = sumOf(failures.map((row) => row.failed));
  const stuck = sumOf(failures.map((row) => row.stuck));

  const rows: AttentionRow[] = [
    {
      count: failed + stuck,
      detail: `${failed} failed · ${stuck} started over ${STUCK_RUNNING_MINUTES / MINUTES_PER_HOUR} hour ago and never finished`,
      href: "/ai",
      title: "Failed AI runs",
    },
    {
      count: inbox.feedback.count,
      detail: `New messages${since(inbox.feedback)}`,
      href: "/feedback/messages",
      title: "Feedback",
    },
    {
      count: inbox.contentFixes.count,
      detail: `Waiting for approval${since(inbox.contentFixes)}`,
      href: "/content-fixes",
      title: "Content fixes",
    },
    {
      count: inbox.sourceChanges.count,
      detail: `Lessons and questions that cite a changed source${since(inbox.sourceChanges)}`,
      href: "/review-flags",
      title: "Source changes",
    },
    {
      count: inbox.accountDeletions.count,
      detail: `Analytics to delete by hand${since(inbox.accountDeletions)}`,
      href: "/account-deletions",
      title: "Account deletions",
    },
    {
      count: missingAudio,
      detail: "Words and sentences without audio",
      href: "/media/missing-audio",
      title: "Missing audio",
    },
  ];

  return rows.filter((row) => row.count > 0);
}

const ROW_CLASS = "flex min-h-14 items-center gap-4 py-2.5";

/** Only what has something waiting: an empty queue isn't a row, and nothing waiting says so. */
export async function HomeAttention() {
  // Review pack only: Home with nothing waiting.
  const clear = (await cookies()).get("adm-clear")?.value === "1";
  const rows = clear ? [] : await loadAttentionRows();

  if (rows.length === 0) {
    return <AdminSectionEmpty>Nothing needs attention.</AdminSectionEmpty>;
  }

  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.href}>
          <Link
            className={`${ROW_CLASS} group hover:bg-muted/50 focus-visible:ring-ring/50 -mx-2.5 rounded-lg px-2.5 outline-none focus-visible:ring-[3px]`}
            href={row.href}
            prefetch
          >
            <span className="text-readout w-12 shrink-0 text-right text-2xl">
              {row.count.toLocaleString("en")}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{row.title}</span>
              <span className="text-muted-foreground text-compact truncate">{row.detail}</span>
            </span>
            <ChevronRightIcon
              aria-hidden="true"
              className="text-faint group-hover:text-foreground edge -me-(--edge-pull) size-4 shrink-0"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

const SKELETON_ROWS = 3;

export function HomeAttentionSkeleton() {
  return (
    <div aria-hidden="true" className="divide-y">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div className={ROW_CLASS} key={index}>
          <Skeleton className="ml-4 h-6 w-8" />
          <span className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-56" />
          </span>
        </div>
      ))}
    </div>
  );
}
