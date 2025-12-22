"use client";

import { useAuthState } from "@zoonk/auth/hooks/state";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ProtectedSection as ProtectedSectionPattern } from "@zoonk/ui/patterns/auth/protected-section";
import { useExtracted } from "next-intl";
import { Link } from "@/i18n/navigation";

export function ProtectedSection({
  children,
}: React.ComponentProps<"section">) {
  const authState = useAuthState();
  const t = useExtracted();

  return (
    <ProtectedSectionPattern
      actions={
        <Link
          className={cn(buttonVariants(), "w-max")}
          href="/login"
          prefetch={false}
        >
          {t("Login")}
        </Link>
      }
      alertTitle={t("You need to be logged in to access this page.")}
      pendingTitle={t("Checking if you're logged in...")}
      state={authState}
    >
      {children}
    </ProtectedSectionPattern>
  );
}
