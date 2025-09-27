"use client";

import { useTranslations } from "next-intl";
import { useLogout } from "@/hooks/useLogout";
import { getMenuIcon } from "./menuIcons";
import { DropdownMenuItem } from "./ui/dropdown-menu";

export function LogoutDropdownItem() {
  const t = useTranslations("Menu");
  const { logout } = useLogout();

  return (
    <DropdownMenuItem onSelect={logout}>
      {getMenuIcon("logout")}
      {t("logout")}
    </DropdownMenuItem>
  );
}
