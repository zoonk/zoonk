"use client";

import { TAB_CLASS, TAB_LIST_CLASS } from "@zoonk/ui/components/tab-class";
import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavigation } from "./admin-navigation";
import { type AdminNavCounts } from "./app-sidebar";

/** Review pack only: the pages of the place you're in, as tabs above the page. */
export function ShortNavTabs({ counts }: { counts: AdminNavCounts }) {
  const pathname = usePathname();

  const group = adminNavigation.find(
    (item) => item.label && item.items.some(({ url }) => pathname.startsWith(url)),
  );

  if (!group?.label) {
    return null;
  }

  return (
    <div className="flex h-14 items-center border-b px-4 sm:px-8 lg:px-10">
      <nav aria-label={group.label} className="min-w-0">
        <ul className={cn(TAB_LIST_CLASS, "-mx-2.5")}>
          {group.items.map((item) => (
            <li key={item.url}>
              <Link
                aria-current={pathname.startsWith(item.url) ? "page" : undefined}
                className={TAB_CLASS}
                href={item.url}
              >
                {item.label}
                {item.queue ? counts[item.queue] : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
