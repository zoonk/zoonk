"use client";

import { useLogout } from "@zoonk/auth/hooks/logout";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { LogOutIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function LogoutMenuItem() {
  const t = useExtracted();
  const { push } = useRouter();
  const { logout } = useLogout({ onSuccess: () => push("/login") });

  return (
    <DropdownMenuItem onClick={logout}>
      <LogOutIcon aria-hidden="true" />
      {t("Logout")}
    </DropdownMenuItem>
  );
}
