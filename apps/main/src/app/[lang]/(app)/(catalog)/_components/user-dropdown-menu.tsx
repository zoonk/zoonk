"use client";

import { Link } from "@/i18n/navigation";
import { type LearnerSummaryState } from "@/lib/learner/learner-snapshot";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { getMenu } from "@/lib/menu";
import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { PlusMark } from "@zoonk/learn/plus-lock";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@zoonk/ui/components/dropdown-menu";
import { useExtracted } from "next-intl";
import { AccountDropdownItem } from "./account-dropdown-item";
import { SearchDropdownItem } from "./search-dropdown-item";
import { UserAvatar } from "./user-avatar";

/** Whose account the menu is: the photo or initial, the name and the email. Nothing for a guest. */
function AccountIdentity({ account }: { account: LearnerSummary["account"] }) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-2 py-2">
        <span className="flex size-8 shrink-0 overflow-hidden rounded-full">
          <UserAvatar image={account.image} name={account.name || account.email} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{account.name}</span>
          <span className="text-muted-foreground truncate text-xs">{account.email}</span>
        </span>
      </div>
      <DropdownMenuSeparator />
    </>
  );
}

/** One of the menu's pages: its icon, then its name and any mark (`children`). */
function MenuPageItem({
  children,
  page,
}: {
  children: React.ReactNode;
  page: Parameters<typeof getMenu>[0];
}) {
  const { icon: Icon, url } = getMenu(page);

  return (
    <DropdownMenuItem render={<Link href={url} prefetch />}>
      <Icon aria-hidden="true" />
      {children}
    </DropdownMenuItem>
  );
}

/**
 * The plan's page: an account's Subscription, marked "Plus" when that's its plan (as the settings
 * hub marks it), where it subscribes or manages the plan; a guest has no account to subscribe with
 * yet, so Pricing says what one would cost.
 */
function PlanItem({ isAccount, plus }: { isAccount: boolean; plus: boolean }) {
  const t = useExtracted();

  if (!isAccount) {
    return <MenuPageItem page="pricing">{t("Pricing")}</MenuPageItem>;
  }

  return (
    <MenuPageItem page="subscription">
      {t("Subscription")}
      {plus && <PlusMark className="ml-auto" label={t("Plus")} />}
    </MenuPageItem>
  );
}

function getAccountStatus(learner: LearnerSummaryState) {
  if (learner.status !== "ready") {
    return "visitor";
  }

  return learner.summary.identity.isAnonymous ? "guest" : "account";
}

/**
 * The account menu: whose account it is, then its pages (settings, the plan and help), then one
 * way in or out. Statistics live in the sidebar and the tabs' top bar instead, and so does search,
 * except on a bar with no search field of its own, where the menu leads with it (`includeSearch`,
 * the same palette Cmd/Ctrl+K opens). A guest's session isn't an account yet, so it has no name to
 * show, sees Pricing for the plan, and is offered an account instead of signing out (which would
 * lose the plan). It opens under the top bar's avatar, at its end, and above the sidebar's account
 * row, from its start (`align`, `side`).
 */
export function UserDropdownMenu({
  align = "end",
  includeSearch = false,
  side = "bottom",
}: {
  align?: "end" | "start";
  includeSearch?: boolean;
  side?: "bottom" | "top";
}) {
  const t = useExtracted();
  const learner = useLearnerSummary();
  const summary = learner.status === "ready" ? learner.summary : null;
  const status = getAccountStatus(learner);
  const isAccount = summary !== null && status === "account";

  return (
    <DropdownMenuContent align={align} className="w-64" keepMounted side={side}>
      {isAccount && <AccountIdentity account={summary.account} />}
      {includeSearch && <SearchDropdownItem />}
      <MenuPageItem page="settings">{t("Settings")}</MenuPageItem>
      <PlanItem isAccount={isAccount} plus={summary?.tier === "plus"} />
      <MenuPageItem page="support">{t("Help")}</MenuPageItem>
      <DropdownMenuSeparator />
      <AccountDropdownItem status={status} />
    </DropdownMenuContent>
  );
}
