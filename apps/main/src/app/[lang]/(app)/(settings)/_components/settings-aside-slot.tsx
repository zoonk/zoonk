"use client";

import { usePathname } from "@/i18n/navigation";

/** A page's detail opens over the aside, so what the aside holds steps out while one is open. */
export function SettingsAsideSlot({
  children,
  detailsUnder,
}: {
  children: React.ReactNode;
  /** The pages whose own pages open as details beside them. */
  detailsUnder: string[];
}) {
  const pathname = usePathname();
  const covered = detailsUnder.some((href) => pathname.startsWith(`${href}/`));

  return (
    <div className="contents" hidden={covered}>
      {children}
    </div>
  );
}
