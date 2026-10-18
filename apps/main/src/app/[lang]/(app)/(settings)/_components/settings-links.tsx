"use client";

import { SectionNav, type SectionNavItem } from "@/components/learn/section-nav";
import { logout } from "@/lib/logout";
import { getMenu } from "@/lib/menu";
import {
  ListGroup,
  ListRowButton,
  ListRowContent,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "@zoonk/learn/list";
import { PlusMark } from "@zoonk/learn/plus-lock";
import { useExtracted } from "next-intl";

/**
 * Which settings pages apply: the profile to an account; the way out to an account, and the plan
 * beside "Subscription" when it's Plus.
 */
export type SettingsPagesShown = { plus: boolean; showLogout: boolean; showProfile: boolean };

type SettingsPage = SectionNavItem<string>;

function toPage(
  key: Parameters<typeof getMenu>[0],
  label: string,
  trail?: React.ReactNode,
): SettingsPage {
  return { label, trail, url: getMenu(key).url };
}

/**
 * The settings pages in two groups: the learner's own (the profile, `withProfile`, where the hub
 * doesn't open it from the account's own row), then the plan and help.
 */
function useSettingsPages({
  plus,
  showProfile,
  withProfile,
}: SettingsPagesShown & { withProfile: boolean }) {
  const t = useExtracted();

  const yours = [
    showProfile && withProfile && toPage("profile", t("Profile")),
    toPage("appearance", t("Preferences")),
    toPage("memory", t("Memory")),
  ].filter((item) => item !== false);

  const plan = [
    toPage("subscription", t("Subscription"), plus ? <PlusMark label={t("Plus")} /> : undefined),
    toPage("support", t("Help")),
  ];

  return { label: t("Settings"), plan, yours };
}

/**
 * The settings pages as tabs under the section's title from a tablet up, the current one marked;
 * the hub shows the first one (the profile for an account), marked there. The way out is in the
 * account menu at the sidebar's end.
 */
export function SettingsNavLinks(shown: SettingsPagesShown) {
  const { label, plan, yours } = useSettingsPages({ ...shown, withProfile: true });
  const first = getMenu(shown.showProfile ? "profile" : "appearance").url;

  return (
    <SectionNav
      hubCurrent={{ hub: getMenu("settings").url, url: first }}
      items={[...yours, ...plan]}
      label={label}
    />
  );
}

/** One group of the hub's rows: each page by its name, with its mark (Plus) when it has one. */
function SettingsGroup({ items }: { items: SettingsPage[] }) {
  return (
    <ListGroup>
      {items.map((item) => (
        <ListRowLink href={item.url} key={item.url}>
          <ListRowContent>
            <ListRowTitle>{item.label}</ListRowTitle>
          </ListRowContent>
          {item.trail !== null && item.trail !== undefined && (
            <ListRowTrailing className={typeof item.trail === "number" ? undefined : "font-sans"}>
              {item.trail}
            </ListRowTrailing>
          )}
        </ListRowLink>
      ))}
    </ListGroup>
  );
}

/** "Log out" as the hub's last row: the account's way out, an action in red, so no chevron. */
function LogoutGroup() {
  const t = useExtracted();

  return (
    <ListGroup>
      <ListRowButton chevron={false} onClick={() => void logout()}>
        <ListRowContent>
          <ListRowTitle className="text-destructive-text">{t("Log out")}</ListRowTitle>
        </ListRowContent>
      </ListRowButton>
    </ListGroup>
  );
}

/**
 * The settings hub's rows, flat on the page: the learner's own pages (the profile opens from the
 * account's row above them), then the plan and help, then the way out, each group apart from the
 * next.
 */
export function SettingsHubLists({
  memoryCount,
  preferencesSummary,
  ...shown
}: SettingsPagesShown & { memoryCount?: number; preferencesSummary?: React.ReactNode }) {
  const { label, plan, yours } = useSettingsPages({ ...shown, withProfile: false });

  const summaries = yours.map((item) => ({
    ...item,
    trail: item.url === getMenu("appearance").url ? preferencesSummary : memoryCount,
  }));

  return (
    <nav aria-label={label} className="flex flex-col gap-6">
      <SettingsGroup items={summaries} />
      <SettingsGroup items={plan} />
      {shown.showLogout && <LogoutGroup />}
    </nav>
  );
}
