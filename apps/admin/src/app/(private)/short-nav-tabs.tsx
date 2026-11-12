"use client";

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

  if (!group) {
    return null;
  }

  return (
    <nav aria-label={group.label} className="flex gap-5 overflow-x-auto border-b px-4 pt-3 md:px-8">
      {group.items.map((item) => (
        <Link
          aria-current={pathname.startsWith(item.url) ? "page" : undefined}
          className={cn(
            "text-muted-foreground hover:text-foreground -mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 border-transparent text-sm font-medium",
            "aria-[current=page]:border-foreground aria-[current=page]:text-foreground",
          )}
          href={item.url}
          key={item.url}
        >
          {item.label}
          {item.queue ? counts[item.queue] : null}
        </Link>
      ))}
    </nav>
  );
}
