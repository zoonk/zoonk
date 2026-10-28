"use client";

import { type AppRoute, Link, usePathname } from "@/i18n/navigation";
import { cn } from "@zoonk/ui/lib/utils";

export type SectionNavItem<Href extends string> = {
  label: string;
  trail?: React.ReactNode;
  url: AppRoute<Href>;
};

const SECTION_NAV_LINK_CLASS = cn(
  "text-muted-foreground hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground focus-visible:ring-ring/50",
  "hit-area relative flex h-7.5 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]",
);

export function SectionNav<Href extends string>({
  hubCurrent,
  items,
  label,
}: {
  hubCurrent?: { hub: string; url: string };
  items: SectionNavItem<Href>[];
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

export function SectionNavSkeleton() {
  return <div aria-hidden="true" className="h-7.5" />;
}
