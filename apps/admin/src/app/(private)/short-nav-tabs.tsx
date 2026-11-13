"use client";

import { TabLink, TabLinks } from "@zoonk/ui/components/tab-links";
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
      <TabLinks label={group.label}>
        {group.items.map((item) => (
          <TabLink
            current={pathname.startsWith(item.url)}
            key={item.url}
            render={<Link href={item.url} />}
          >
            {item.label}
            {item.queue ? counts[item.queue] : null}
          </TabLink>
        ))}
      </TabLinks>
    </div>
  );
}
