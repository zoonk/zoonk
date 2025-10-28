"use client";

import { useAuthState } from "@zoonk/auth/hooks/state";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ProtectedSection as ProtectedSectionPattern } from "@zoonk/ui/patterns/auth/protected-section";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function ProtectedSection({
  children,
}: React.ComponentProps<"section">) {
  const authState = useAuthState();
  const t = useTranslations("Protected");

  return (
    <ProtectedSectionPattern
      actions={
        <Link className={cn(buttonVariants(), "w-max")} href="/login">
          {t("login")}
        </Link>
      }
      alertTitle={t("requiresLogin")}
      pendingTitle={t("checkingLogin")}
      state={authState}
    >
      {children}
    </ProtectedSectionPattern>
  );
}
