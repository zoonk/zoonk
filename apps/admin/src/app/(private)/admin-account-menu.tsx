"use client";

import { logout } from "@zoonk/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "@zoonk/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { SIDEBAR_ACCOUNT_CLASS } from "@zoonk/ui/components/sidebar";
import { SidebarTooltip } from "@zoonk/ui/components/sidebar-toggle";
import { cn } from "@zoonk/ui/lib/utils";
import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { CLI_LOGINS_PAGE } from "./admin-navigation";

/** The 24 px avatar is centered on the items' 16 px icons, so its name needs 6 px to start on their labels' edge. */
const LABEL_EDGE_AFTER_AVATAR = "gap-1.5";

export type AdminAccount = { email: string; image: string | null; name: string };

export function AdminAccountMenu({ account }: { account: AdminAccount }) {
  const name = account.name || account.email;
  const CliLoginsIcon = CLI_LOGINS_PAGE.icon;

  return (
    <DropdownMenu>
      <SidebarTooltip label={name}>
        <DropdownMenuTrigger className={cn(SIDEBAR_ACCOUNT_CLASS, LABEL_EDGE_AFTER_AVATAR)}>
          <Avatar aria-hidden="true" className="size-6">
            <AvatarImage src={account.image ?? undefined} />
            <AvatarFallback>{name[0]}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate">{name}</span>
        </DropdownMenuTrigger>
      </SidebarTooltip>

      <DropdownMenuContent align="start" side="top">
        <p className="text-muted-foreground truncate px-3 py-2.5 text-xs">{account.email}</p>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={CLI_LOGINS_PAGE.url} prefetch />}>
          <CliLoginsIcon aria-hidden="true" />
          {CLI_LOGINS_PAGE.label}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOutIcon aria-hidden="true" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
