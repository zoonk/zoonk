"use client";

import { Link } from "@/i18n/navigation";
import { type LearnerSummaryState } from "@/lib/learner/learner-snapshot";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { getMenu } from "@/lib/menu";
import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { SendFeedbackItem } from "@zoonk/learn/feedback/menu-items";
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

/** A guest has no account to subscribe with yet, so Pricing says what one would cost. */
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

/** A guest is offered an account instead of signing out, which would lose their plan. */
export function UserDropdownMenu({
  align = "end",
  includeFeedback = true,
  includeSearch = false,
  side = "bottom",
}: {
  align?: "end" | "start";
  includeFeedback?: boolean;
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
      {includeFeedback && <SendFeedbackItem screen="account-menu" />}
      <DropdownMenuSeparator />
      <AccountDropdownItem status={status} />
    </DropdownMenuContent>
  );
}
