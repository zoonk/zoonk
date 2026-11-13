import { AdminSectionEmpty } from "@/components/admin-section";
import { STAT_TILES_CLASS, StatTile, StatTileSkeleton } from "@/components/stat-tile";
import { formatDollars } from "@/lib/ai-format";
import { formatDuration } from "@/lib/format-duration";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Stat } from "@zoonk/ui/components/stat";
import { cn } from "@zoonk/ui/lib/utils";
import {
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CpuIcon,
  type LucideIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { adminPages } from "./admin-navigation";
import { type AttentionItem, WEEK_DAYS, type WeekNumber, type loadWeek } from "./home-data";

const formatNumber = (value: number) => value.toLocaleString("en");

/** A tile wears its page's icon, the one the sidebar and the palette show for it. */
function pageIcon(href: string): LucideIcon {
  const path = href.split("?")[0];
  return adminPages.find((page) => page.url === path)?.icon ?? CpuIcon;
}

/**
 * What waits, as one tile each: its page's icon and name, how many, and since when. Something that
 * failed is pink-red, the color failure has on every page; work waiting its turn is neutral.
 */
export function AttentionTiles({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <AdminSectionEmpty>
        <CheckIcon
          aria-hidden="true"
          className="text-success me-1.5 inline size-4 align-[-0.2em]"
        />
        Nothing needs attention.
      </AdminSectionEmpty>
    );
  }

  return (
    <ul className={ATTENTION_GRID_CLASS}>
      {items.map((item) => {
        const Icon = pageIcon(item.href);

        return (
          <li key={item.href}>
            <Stat
              className="group hover:bg-muted/50 h-full gap-2 transition-colors"
              render={<Link href={item.href} prefetch />}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0",
                    item.failed ? "text-destructive" : "text-muted-foreground",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <ChevronRightIcon
                  aria-hidden="true"
                  className="text-faint group-hover:text-foreground size-4 shrink-0"
                />
              </span>
              <span className={cn("text-readout text-3xl", item.failed && "text-destructive-text")}>
                {formatNumber(item.count)}
              </span>
              <span className="text-muted-foreground text-compact text-pretty">{item.detail}</span>
            </Stat>
          </li>
        );
      })}
    </ul>
  );
}

const ATTENTION_GRID_CLASS = "grid gap-2 sm:grid-cols-2 xl:grid-cols-3";
const SKELETON_TILES = 3;

export function AttentionTilesSkeleton() {
  return (
    <div aria-hidden="true" className={ATTENTION_GRID_CLASS}>
      {Array.from({ length: SKELETON_TILES }, (_, index) => (
        <Stat className="gap-2" key={index}>
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-28" />
          </span>
          <span className="flex h-7.5 items-center">
            <Skeleton className="h-7 w-10" />
          </span>
          <span className="flex h-5 items-center">
            <Skeleton className="h-3 w-48 max-w-full" />
          </span>
        </Stat>
      ))}
    </div>
  );
}

function trendOf(number: WeekNumber, title: string) {
  return { before: WEEK_DAYS, label: `${title} a day, the last 14 days`, values: number.daily };
}

export function WeekTiles({
  className = STAT_TILES_CLASS,
  week,
}: {
  className?: string;
  week: Awaited<ReturnType<typeof loadWeek>>;
}) {
  return (
    <div className={className}>
      <StatTile
        change={{ ...week.activeLearners, fall: "watch", format: formatNumber, rise: "good" }}
        help="Users who completed at least 1 lesson"
        href="/stats/engagement?view=active-learners"
        icon={<UsersIcon />}
        title="Active learners"
        trend={trendOf(week.activeLearners, "Active learners")}
        value={formatNumber(week.activeLearners.current)}
      />

      <StatTile
        change={{ ...week.signups, fall: "watch", format: formatNumber, rise: "good" }}
        href="/stats/growth?view=new-signups"
        icon={<UserPlusIcon />}
        title="New signups"
        trend={trendOf(week.signups, "New signups")}
        value={formatNumber(week.signups.current)}
      />

      <StatTile
        change={{ ...week.time, fall: "watch", format: formatDuration, rise: "good" }}
        help="Recorded study time across all learners"
        href="/stats/engagement?view=total-learning-time"
        icon={<ClockIcon />}
        title="Learning time"
        trend={trendOf(week.time, "Learning time")}
        value={formatDuration(week.time.current)}
      />

      <StatTile
        change={{ ...week.spend, format: formatDollars, rise: "watch" }}
        href="/ai"
        icon={<CpuIcon />}
        title="AI spend"
        trend={trendOf(week.spend, "AI spend")}
        value={formatDollars(week.spend.current)}
      />
    </div>
  );
}

export function WeekTilesSkeleton({ className = STAT_TILES_CLASS }: { className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: 4 }, (_, index) => (
        <StatTileSkeleton key={index} trend />
      ))}
    </div>
  );
}
