"use client";

import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { getPathname, usePathname } from "@/i18n/navigation";
import { usePageAsksForAccount } from "@zoonk/learn/account-ask";
import { ListGroup, ListRowContent, ListRowLink, ListRowTitle } from "@zoonk/learn/list";
import { useAppLocale } from "@zoonk/learn/locale";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { LogInIcon, UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";

/**
 * Until the first client navigation the document holds only the page on screen, so its own ask
 * can hide the button from the first paint, before that page has hydrated. After one, the router
 * keeps visited pages hidden in the document, and only the page's mounted ask counts.
 */
const FIRST_PAGE_ASKS_CLASS = "in-[body:has([data-account-ask])]:hidden";

function useHasNavigated(): boolean {
  const pathname = usePathname();
  const [firstPath, setFirstPath] = useState<string | null>(pathname);

  if (firstPath !== null && pathname !== firstPath) {
    setFirstPath(null);
  }

  return firstPath === null;
}

/** A page that already asks for an account in its own words (a gate, Reminders' email row) doesn't repeat the button in the bar. */
function useAskedClass(): string {
  const asked = usePageAsksForAccount();
  const navigated = useHasNavigated();

  return cn(asked && "hidden", !navigated && FIRST_PAGE_ASKS_CLASS);
}

export function SettingsAccountButton({ status }: { status: "guest" | "visitor" }) {
  const t = useExtracted();
  const askedClass = useAskedClass();
  const className = buttonVariants({ className: askedClass, size: "bar", variant: "outline" });

  // From `lg` the sidebar ends with its own "Log in".
  if (status === "visitor") {
    return (
      <CurrentPageLoginLink
        className={cn(className, "lg:hidden")}
        icon={<LogInIcon aria-hidden="true" />}
      >
        {t("Log in")}
      </CurrentPageLoginLink>
    );
  }

  return (
    <CurrentPageLoginLink className={className} icon={<UserPlusIcon aria-hidden="true" />}>
      {t("Create a free account")}
    </CurrentPageLoginLink>
  );
}

/**
 * A guest's row at the top of the Settings list on a phone, where an account holder's row with
 * their name is: there the bar has no row of its own to hold the button.
 */
export function SettingsAccountRow() {
  const t = useExtracted();
  const locale = useAppLocale();
  const next = getPathname({ href: "/settings", locale });

  return (
    <ListGroup>
      <ListRowLink className="min-h-14" href={`/login?next=${encodeURIComponent(next)}`}>
        <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center self-center rounded-full">
          <UserPlusIcon aria-hidden="true" className="size-4" />
        </span>
        <ListRowContent>
          <ListRowTitle>{t("Create a free account")}</ListRowTitle>
        </ListRowContent>
      </ListRowLink>
    </ListGroup>
  );
}
