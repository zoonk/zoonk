"use client";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { useExtracted } from "next-intl";

export function LogoutMenuItem() {
  const t = useExtracted();

  return (
    <DropdownMenuItem render={<Link href="/logout" prefetch={false} />}>
      <LogOutIcon aria-hidden="true" />
      {t("Logout")}
    </DropdownMenuItem>
  );
}
