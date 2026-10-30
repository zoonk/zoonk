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
import { LogOutIcon } from "lucide-react";

export type AdminAccount = { email: string; image: string | null; name: string };

export function AdminAccountMenu({ account }: { account: AdminAccount }) {
  const name = account.name || account.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={SIDEBAR_ACCOUNT_CLASS}>
        <Avatar aria-hidden="true" className="size-6">
          <AvatarImage src={account.image ?? undefined} />
          <AvatarFallback>{name[0]}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate">{name}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top">
        <p className="text-muted-foreground truncate px-3 py-2.5 text-xs">{account.email}</p>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOutIcon aria-hidden="true" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
