"use client";

import { openAdminMenu } from "@/lib/admin-menu-event";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { BarSearch } from "@zoonk/ui/components/sidebar-toggle";
import { openCommandPalette } from "@zoonk/ui/lib/command-palette-event";
import { EllipsisIcon, MenuIcon } from "lucide-react";

/** A record's "…" in the page's bar: what staff do to it less often, after its buttons. */
export function AdminBarMenu({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon-bar" variant="outline" />}>
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Where the sidebar is hidden, the page's bar opens the menu from its start. */
export function AdminBarMenuButton() {
  return (
    <Button
      aria-haspopup="dialog"
      className="lg:hidden"
      edge="start"
      onClick={openAdminMenu}
      size="icon-bar"
      variant="ghost"
    >
      <MenuIcon aria-hidden="true" />
      <span className="sr-only">Menu</span>
    </Button>
  );
}

/** And search from its end, in place of the sidebar's search field. */
export function AdminBarSearchButton() {
  return <BarSearch className="lg:hidden" edge="end" label="Search" onClick={openCommandPalette} />;
}
