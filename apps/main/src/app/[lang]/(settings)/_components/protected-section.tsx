import { Link } from "@/i18n/navigation";
import { getSession } from "@zoonk/core/users/session";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ProtectedSection as ProtectedSectionPattern } from "@zoonk/ui/patterns/auth/protected";
import { getExtracted } from "next-intl/server";

/**
 * A settings section for people with a session. Visitors are asked to log in; guests too, unless the
 * section is theirs as well (`allowGuests`), since a guest's session isn't an account yet.
 */
export async function ProtectedSection({
  allowGuests = false,
  children,
}: {
  allowGuests?: boolean;
  children: React.ReactNode;
}) {
  const session = await getSession();
  const t = await getExtracted();
  const isGuest = Boolean(session?.user.isAnonymous);

  if (isGuest && !allowGuests) {
    return (
      <ProtectedSectionPattern
        actions={
          <Link className={cn(buttonVariants(), "w-max")} href="/login" prefetch={false}>
            {t("Create an account")}
          </Link>
        }
        alertTitle={t("Create an account to keep your plan and use this page.")}
        state="unauthenticated"
      />
    );
  }

  return (
    <ProtectedSectionPattern
      actions={
        <Link className={cn(buttonVariants(), "w-max")} href="/login" prefetch={false}>
          {t("Login")}
        </Link>
      }
      alertTitle={t("You need to be logged in to access this page.")}
      state={session ? "authenticated" : "unauthenticated"}
    >
      {children}
    </ProtectedSectionPattern>
  );
}
