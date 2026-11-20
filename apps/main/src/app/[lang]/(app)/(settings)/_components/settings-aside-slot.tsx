"use client";

import { usePathname } from "@/i18n/navigation";
import { Skeleton } from "@zoonk/ui/components/skeleton";

/**
 * What the section's aside holds, page by page: what one page adds, which is the same for
 * everyone, and under it the account where it matters, so an account that arrives late or turns
 * out to be nobody's moves nothing. A page with neither leaves it empty, as a visitor's account
 * does, and the aside then shows only for what the page itself says beside its rows
 * (`PageAsideNote`).
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
  /** What one page shows over it. */
  extras: { content: React.ReactNode; href: string }[];
}) {
  const pathname = usePathname();
  const extra = extras.find((item) => item.href === pathname);
  const account = accountOn.includes(pathname);

  return (
    <div className="contents">
      {extra?.content}
      {account && children}
    </div>
  );
}

/**
 * Holds the account's place while it loads, as tall as the account is, only on the page that
 * only an account holder is led to. Anywhere else a guest has none, so nothing is drawn until
 * the account says whose page it is.
 */
export function SettingsAsideSkeleton({ on }: { on: string }) {
  const pathname = usePathname();

  if (pathname !== on) {
    return null;
  }

  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <Skeleton className="my-0.5 h-5 w-24" />
      <Skeleton className="my-0.5 h-4 w-48" />
    </div>
  );
}
