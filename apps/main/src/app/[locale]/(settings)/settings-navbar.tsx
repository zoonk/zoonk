"use client";

import { useLogout } from "@zoonk/auth/hooks/logout";
import { buttonVariants } from "@zoonk/ui/components/button";
import { LogOut, MessageCircle, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { Suspense } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { SettingsNavigation } from "./settings-navigation";

export function SettingsNavbar() {
  const { push } = useRouter();
  const t = useExtracted();
  const { isLoggedIn, logout } = useLogout({ onSuccess: () => push("/login") });

  return (
    <nav className="sticky top-0 z-10 flex w-full items-center justify-between gap-2 border-border border-b bg-background/95 p-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex items-center gap-2">
        <Link
          className={buttonVariants({
            size: "icon",
            variant: "destructive",
          })}
          href="/"
        >
          <X aria-hidden="true" />
          <span className="sr-only">{t("Close settings")}</span>
        </Link>

        <Suspense>
          <SettingsNavigation />
        </Suspense>
      </div>

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
