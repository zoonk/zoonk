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
      state={authState}
      pendingTitle={t("checkingLogin")}
      alertTitle={t("requiresLogin")}
      actions={
        <Link href="/login" className={cn(buttonVariants(), "w-max")}>
          {t("login")}
        </Link>
      }
    >
      {children}
    </ProtectedSectionPattern>
  );
}
