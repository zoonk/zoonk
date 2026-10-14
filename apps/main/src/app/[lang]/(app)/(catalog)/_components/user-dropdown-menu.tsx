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
import { type LucideIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { AccountDropdownItem } from "./account-dropdown-item";
import { SearchDropdownItem } from "./search-dropdown-item";
import { UserAvatar } from "./user-avatar";

/**
 * Whose account the menu is: the photo or initial, the name and the email, and "Plus" when that's
 * the plan. Nothing for a guest.
 */
function AccountIdentity({ summary }: { summary: LearnerSummary }) {
  const t = useExtracted();
  const { account, tier } = summary;

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
        {tier === "plus" && <PlusMark label={t("Plus")} />}
      </div>
      <DropdownMenuSeparator />
    </>
  );
}

type MenuEntry = { icon: LucideIcon; key: string; trail?: string; url: string };

function MenuGroup({ items }: { items: MenuEntry[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {items.map((menu) => (
        <DropdownMenuItem key={menu.url} render={<Link href={menu.url} prefetch />}>
          <menu.icon aria-hidden="true" />
          <span className="flex-1">{menu.key}</span>
          {menu.trail && (
            <span className="text-muted-foreground font-mono text-[0.6875rem] tabular-nums">
              {menu.trail}
            </span>
          )}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
    </>
  );
}

function getAccountStatus(learner: LearnerSummaryState) {
  if (learner.status !== "ready") {
    return "visitor";
  }

  return learner.summary.identity.isAnonymous ? "guest" : "account";
}

/**
 * The account menu: whose account it is (and "Plus" when it's the plan), the app's search (the same
 * palette Cmd/Ctrl+K opens), the learner's statistics (with their level), then settings and help,
 * and one way in or out. A guest's session isn't an account yet, so it offers one instead of
 * signing out (which would lose the plan), has no name to show, and has Pricing beside the
 * statistics. It opens under the top bar's avatar, at its end, and above the sidebar's account
 * row, from its start (`align`, `side`).
 */
export function UserDropdownMenu({
  align = "end",
  side = "bottom",
}: {
  align?: "end" | "start";
  side?: "bottom" | "top";
}) {
  const t = useExtracted();
  const learner = useLearnerSummary();
  const summary = learner.status === "ready" ? learner.summary : null;
  const status = getAccountStatus(learner);

  const places = [
    summary
      ? {
          key: t("Statistics"),
          trail: summary.level
            ? t("Level {level}", { level: String(summary.level.level) })
            : undefined,
          ...getMenu("stats"),
        }
      : null,
    status === "guest" ? { key: t("Pricing"), ...getMenu("pricing") } : null,
  ].filter((item) => item !== null);

  const settings = [
    { key: t("Settings"), ...getMenu("settings") },
    { key: t("Help"), ...getMenu("support") },
  ];

  return (
    <DropdownMenuContent align={align} className="w-64" keepMounted side={side}>
      {summary && status === "account" && <AccountIdentity summary={summary} />}
      <SearchDropdownItem />
      <MenuGroup items={places} />
      <MenuGroup items={settings} />
      <AccountDropdownItem status={status} />
    </DropdownMenuContent>
  );
}
