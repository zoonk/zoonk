"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { DropdownMenuItem } from "./ui/dropdown-menu";

export function LogoutDropdownItem() {
  const router = useRouter();
  const t = useTranslations("Menu");

  const logout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  };

  return (
    <DropdownMenuItem onClick={logout}>
      <LogOut aria-hidden="true" />
      {t("logout")}
    </DropdownMenuItem>
  );
}
