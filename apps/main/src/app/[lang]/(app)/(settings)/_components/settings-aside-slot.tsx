"use client";

import { usePathname } from "@/i18n/navigation";

/**
 * What the section's aside holds, page by page: the account where it matters, what one page adds
 * under it, or the room a page fills itself. A page with none of these has no aside, and what the
 * aside holds steps out while a detail is open over it.
 */
export function SettingsAsideSlot({
  accountOn,
  children,
  extras,
  filledBy,
}: {
  /** The pages that show whose account this is. */
  accountOn: string[];
  /** The account. */
  children: React.ReactNode;
  /** What one page shows beside it. */
  extras: { content: React.ReactNode; href: string }[];
  /** The pages that draw into the aside's room themselves. */
  filledBy: string[];
}) {
  const pathname = usePathname();
  const extra = extras.find((item) => item.href === pathname);
  const account = accountOn.includes(pathname);

  return (
    <div
      className="contents in-data-side-detail:hidden"
      hidden={!account && !extra && !filledBy.includes(pathname)}
    >
      {account && children}
      {extra?.content}
    </div>
  );
}
