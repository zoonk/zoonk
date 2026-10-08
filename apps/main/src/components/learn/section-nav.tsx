"use client";

import { type AppRoute, Link, usePathname } from "@/i18n/navigation";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { type LucideIcon } from "lucide-react";

export type SectionNavItem<Href extends string> = {
  icon: LucideIcon;
  label: string;
  /** The tile's color, the one its page uses (a stat's); neutral by default. */
  tone?: string;
  /** A short value at the row's end, such as the plan ("Plus"). */
  trail?: string;
  url: AppRoute<Href>;
};

/** A row's icon on its small tile, in its page's color. */
export function SectionNavTile({ icon: Icon, tone }: { icon: LucideIcon; tone?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4",
        tone ?? "bg-muted text-foreground/80",
      )}
    >
      <Icon />
    </span>
  );
}

/** One row of the sidebar: its tile, its name and its value, the current page filled. */
export const SECTION_NAV_ROW_CLASS =
  "focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]";

/**
 * A section's pages beside the page from `lg` (settings, statistics), in their groups, the current
 * one filled, so the learner moves between them without going back to the hub. `header` goes above
 * them (whose settings these are) and `footer` below (the way out). On phones the hub lists them
 * and each page goes back to it, so this stays hidden there.
 */
export function SectionNav<Href extends string>({
  footer,
  groups,
  header,
  hubCurrent,
  label,
}: {
  footer?: React.ReactNode;
  groups: SectionNavItem<Href>[][];
  header?: React.ReactNode;
  /** The page the hub shows beside the sidebar from `lg` (settings' profile), filled there. */
  hubCurrent?: { hub: string; url: string };
  /** The navigation's accessible name, such as "Settings". */
  label: string;
}) {
  const pathname = usePathname();
  const current = hubCurrent && pathname === hubCurrent.hub ? hubCurrent.url : pathname;

  return (
    <nav aria-label={label} className="flex flex-col gap-4">
      {header}

      {groups
        .filter((items) => items.length > 0)
        .map((items) => (
          <ul className="flex flex-col gap-0.5" key={items[0]?.url}>
            {items.map((item) => {
              const isCurrent = current === item.url;

              return (
                <li key={item.url}>
                  <Link
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      SECTION_NAV_ROW_CLASS,
                      isCurrent ? "bg-foreground/10" : "hover:bg-muted/60",
                    )}
                    href={item.url}
                    prefetch
                  >
                    <SectionNavTile icon={item.icon} tone={item.tone} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.trail && (
                      <span className="text-muted-foreground shrink-0 text-xs font-normal tabular-nums">
                        {item.trail}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}

      {footer}
    </nav>
  );
}

/** About as many rows as a section has, while what they depend on (the session) resolves. */
const SKELETON_ROWS = 5;

/** Holds the sidebar's rows while what they depend on (the session) resolves. */
export function SectionNavSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton className="h-10 w-full rounded-xl" key={index} />
      ))}
    </div>
  );
}
