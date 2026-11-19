"use client";

import { usePathname } from "@/i18n/navigation";

/**
 * What the section's aside holds, page by page: the account where it matters and what one page
 * adds under it. A page with neither leaves it empty, and the aside then shows only for what the
 * page itself says beside its rows (`PageAsideNote`).
 */
export function SettingsAsideSlot({
  accountOn,
  children,
  extras,
}: {
  /** The pages that show whose account this is. */
  accountOn: string[];
  /** The account. */
  children: React.ReactNode;
  /** What one page shows beside it. */
  extras: { content: React.ReactNode; href: string }[];
}) {
  const pathname = usePathname();
  const extra = extras.find((item) => item.href === pathname);
  const account = accountOn.includes(pathname);

  return (
    <div className="contents" hidden={!account && !extra}>
      {account && children}
      {extra?.content}
    </div>
  );
}
