"use client";

import { usePathname } from "@/i18n/navigation";
import { Skeleton } from "@zoonk/ui/components/skeleton";

/**
 * What the section's aside holds, page by page: the account where it matters and what one page
 * adds under it. A page with neither leaves it empty, as a visitor's account does, and the aside
 * then shows only for what the page itself says beside its rows (`PageAsideNote`).
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
    <div className="contents">
      {account && children}
      {extra?.content}
    </div>
  );
}

/**
 * Holds the account's place while it loads, as tall as the account is, except on the section's
 * first page: there a guest's page fills the room with no aside, so nothing is drawn until the
 * account says whose page it is.
 */
export function SettingsAsideSkeleton({ hub }: { hub: string }) {
  const pathname = usePathname();

  if (pathname === hub) {
    return null;
  }

  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <Skeleton className="my-0.5 h-5 w-24" />
      <Skeleton className="my-0.5 h-4 w-48" />
    </div>
  );
}
