"use client";

import { useLogout } from "@zoonk/auth/hooks/logout";
import { buttonVariants } from "@zoonk/ui/components/button";
import { LogOut, MessageCircle } from "lucide-react";
import { useExtracted } from "next-intl";
import { Suspense } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { SettingsNavigation } from "./settings-navigation";

export function SettingsNavbar() {
  const { push } = useRouter();
  const t = useExtracted();
  const { isLoggedIn, logout } = useLogout({ onSuccess: () => push("/login") });

  return (
    <nav className="flex w-full items-center justify-between gap-2 border-border border-b bg-background p-4">
      <Suspense>
        <SettingsNavigation />
      </Suspense>

      <div className="flex items-center gap-2">
        <Link
          className={buttonVariants({
            size: "icon",
            variant: "outline",
          })}
          href="/feedback"
        >
          <MessageCircle aria-hidden="true" />
          <span className="sr-only">{t("Feedback")}</span>
        </Link>

        {isLoggedIn && (
          <button
            className={buttonVariants({
              size: "icon",
              variant: "secondary",
            })}
            onClick={logout}
            type="button"
          >
            <LogOut aria-hidden="true" />
            <span className="sr-only">{t("Logout")}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
