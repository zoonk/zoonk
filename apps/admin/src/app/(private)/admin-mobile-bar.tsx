"use client";

import { Button } from "@zoonk/ui/components/button";
import { MenuIcon } from "lucide-react";
import { useState } from "react";
import { type AdminAccount } from "./admin-account-menu";
import { AdminMenuSheet } from "./app-sidebar";

export function AdminMobileBar({ account }: { account: AdminAccount }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex items-center gap-1 px-4 pt-1.5 sm:px-8 lg:hidden">
      <Button className="-ml-3.5" onClick={() => setOpen(true)} size="icon-bar" variant="ghost">
        <MenuIcon aria-hidden="true" />
        <span className="sr-only">Menu</span>
      </Button>

      <span className="text-sm font-semibold">Zoonk Admin</span>

      <AdminMenuSheet account={account} onOpenChange={setOpen} open={open} />
    </header>
  );
}
