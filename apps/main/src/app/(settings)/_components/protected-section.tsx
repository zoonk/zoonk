import { getSession } from "@zoonk/core/users/session/get";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ProtectedSection as ProtectedSectionPattern } from "@zoonk/ui/patterns/auth/protected";
import { getExtracted } from "next-intl/server";
import Link from "next/link";

export async function ProtectedSection({ children }: React.ComponentProps<"section">) {
  const session = await getSession();
  const t = await getExtracted();
  const state = session ? "authenticated" : "unauthenticated";

  return (
    <ProtectedSectionPattern
      actions={
        <Link className={cn(buttonVariants(), "w-max")} href="/login" prefetch={false}>
          {t("Login")}
        </Link>
      }
      alertTitle={t("You need to be logged in to access this page.")}
      state={state}
    >
      {children}
    </ProtectedSectionPattern>
  );
}
