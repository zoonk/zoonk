"use client";

import { Button } from "@zoonk/ui/components/button";
import { SidebarSearch } from "@zoonk/ui/components/sidebar-toggle";
import { openCommandPalette } from "@zoonk/ui/lib/command-palette-event";
import { MenuIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { type AdminAccount } from "./admin-account-menu";
import { AdminMenuSheet } from "./app-sidebar";

export function AdminMobileBar({ account }: { account: AdminAccount }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <AdminMobileBarContent account={account} key={`${pathname}?${searchParams.toString()}`} />;
}

function AdminMobileBarContent({ account }: { account: AdminAccount }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex items-center gap-1 px-4 pt-1.5 sm:px-8 lg:hidden">
      <Button className="-ml-3.5" onClick={() => setOpen(true)} size="icon-bar" variant="ghost">
        <MenuIcon aria-hidden="true" />
        <span className="sr-only">Menu</span>
      </Button>

      <span className="text-sm font-semibold">Zoonk Admin</span>

      <SidebarSearch
        className="ml-auto max-w-64 flex-1"
        label="Search…"
        onClick={openCommandPalette}
        placement="bar"
      />

      <AdminMenuSheet account={account} onOpenChange={setOpen} open={open} />
    </header>
  );
}
