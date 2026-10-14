"use client";

import { type AppRoute, Link, usePathname } from "@/i18n/navigation";
import { cn } from "@zoonk/ui/lib/utils";

export type SectionNavItem<Href extends string> = {
  label: string;
  /** Reaching for the tab (pointer over, focus, press), to start loading what its page draws. */
  onIntent?: () => void;
  /** A short mark after the name, such as the plan (`PlusMark`). */
  trail?: React.ReactNode;
  url: AppRoute<Href>;
};

/**
 * One page of a section in its in-page nav: its name, quiet until hovered, the current page on a
 * soft fill, as Linear's view tabs. Its text lines up with the column's edge.
 */
const SECTION_NAV_LINK_CLASS = cn(
  "text-muted-foreground hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground focus-visible:ring-ring/50",
  "hit-area relative flex h-7.5 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]",
);

/**
 * A section's pages (statistics, settings) as a row of tabs under the section's title, from a
 * tablet up (`SectionPage` shows them there): the learner moves between them without leaving the
 * column. On phones the section's first page lists them and each page goes back to it.
 */
export function SectionNav<Href extends string>({
  hubCurrent,
  items,
  label,
}: {
  /** The page the hub shows from `lg` (settings' profile), current while the hub is open. */
  hubCurrent?: { hub: string; url: string };
  items: SectionNavItem<Href>[];
  /** The navigation's accessible name, such as "Settings". */
  label: string;
}) {
  const pathname = usePathname();
  const current = hubCurrent && pathname === hubCurrent.hub ? hubCurrent.url : pathname;

  return (
    <nav aria-label={label} data-slot="section-nav">
      <ul className="-mx-2.5 -my-2 flex scrollbar-none gap-0.5 overflow-x-auto py-2">
        {items.map((item) => (
          <li key={item.url}>
            <Link
              aria-current={current === item.url ? "page" : undefined}
              className={SECTION_NAV_LINK_CLASS}
              href={item.url}
              onFocus={item.onIntent}
              onPointerDown={item.onIntent}
              onPointerEnter={item.onIntent}
              prefetch
            >
              {item.label}
              {item.trail}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Holds the tabs' row while what they depend on (the session) resolves. */
export function SectionNavSkeleton() {
  return <div aria-hidden="true" className="h-7.5" />;
}
