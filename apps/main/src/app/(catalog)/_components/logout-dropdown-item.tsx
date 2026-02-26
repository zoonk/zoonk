"use client";

import Link from "next/link";
import { authClient, logout } from "@zoonk/core/auth/client";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { LogOut, User } from "lucide-react";
import { useExtracted } from "next-intl";

export function LogoutDropdownItem() {
  const { data: session } = authClient.useSession();
  const t = useExtracted();

  if (!session) {
    return (
      <DropdownMenuItem render={<Link href="/login" prefetch={false} />}>
        <User aria-hidden="true" />
        {t("Login")}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem onClick={() => logout()}>
      <LogOut aria-hidden="true" />
      {t("Logout")}
    </DropdownMenuItem>
  );
}
