"use client";
import { logout } from "@zoonk/core/auth/client";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { LogOutIcon } from "lucide-react";
import { useExtracted } from "next-intl";

export function LogoutMenuItem() {
  const t = useExtracted();

  return (
    <DropdownMenuItem onClick={() => logout()}>
      <LogOutIcon aria-hidden="true" />
      {t("Logout")}
    </DropdownMenuItem>
  );
}
