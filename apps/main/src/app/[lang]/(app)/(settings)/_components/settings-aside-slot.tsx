"use client";

import { usePathname } from "@/i18n/navigation";

/**
 * What the section's aside holds: it steps out while a page's detail is open over it, and one page
 * may add something of its own under it.
 */
export function SettingsAsideSlot({
  children,
  detailsUnder,
  extras,
}: {
  children: React.ReactNode;
  /** The pages whose own pages open as details beside them. */
  detailsUnder: string[];
  /** What one page shows beside it, after what every page shows. */
  extras: { content: React.ReactNode; href: string }[];
}) {
  const pathname = usePathname();
  const covered = detailsUnder.some((href) => pathname.startsWith(`${href}/`));

  return (
    <div className="contents in-data-side-detail:hidden" hidden={covered}>
      {children}
      {extras.find((extra) => extra.href === pathname)?.content}
    </div>
  );
}
