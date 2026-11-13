"use client";

import { listenForAdminMenuOpen } from "@/lib/admin-menu-event";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { type AdminAccount } from "./admin-account-menu";
import { AdminMenuSheet, type AdminNavCounts } from "./app-sidebar";

type AdminMenuProps = { account: AdminAccount; counts: AdminNavCounts };

/**
 * The menu where the sidebar is hidden. A page's bar asks for it; it lives here, in the layout,
 * which holds the account and the counts. A new address closes it.
 */
export function AdminMobileMenu(props: AdminMenuProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <AdminMobileMenuSheet {...props} key={`${pathname}?${searchParams.toString()}`} />;
}

function AdminMobileMenuSheet({ account, counts }: AdminMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => listenForAdminMenuOpen(() => setOpen(true)), []);

  return <AdminMenuSheet account={account} counts={counts} onOpenChange={setOpen} open={open} />;
}
