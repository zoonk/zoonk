"use client";

import { type AppRoute, Link, usePathname } from "@/i18n/navigation";
import { TAB_CLASS, TAB_LIST_CLASS } from "@zoonk/ui/components/tab-class";
import { cn } from "@zoonk/ui/lib/utils";

export type SectionNavItem<Href extends string> = {
  label: string;
  trail?: React.ReactNode;
  url: AppRoute<Href>;
};

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
      <ul className={cn(TAB_LIST_CLASS, "-mx-2.5 -my-2 scrollbar-none overflow-x-auto py-2")}>
        {items.map((item) => (
          <li key={item.url}>
            <Link
              aria-current={
                current === item.url || current.startsWith(`${item.url}/`) ? "page" : undefined
              }
              className={TAB_CLASS}
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
