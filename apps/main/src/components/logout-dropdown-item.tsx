"use client";

import { useLogout } from "@zoonk/auth/hooks/logout";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/client";
import { getMenu } from "@/lib/menu";

const logoutMenu = getMenu("logout");

export function LogoutDropdownItem() {
  const { data: session } = authClient.useSession();
  const { push } = useRouter();
  const t = useTranslations("Menu");
  const { logout } = useLogout({ onSuccess: () => push("/login") });

  if (!session) {
    return (
      <DropdownMenuItem asChild>
        <Link href="/login">
          <User aria-hidden="true" />
          {t("login")}
        </Link>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem onSelect={logout}>
      <logoutMenu.icon aria-hidden="true" />
      {t("logout")}
    </DropdownMenuItem>
  );
}
