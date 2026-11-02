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

export type SettingsPagesShown = { plus: boolean; showLogout: boolean; showProfile: boolean };

type SettingsPage = SectionNavItem<string>;

function toPage(
  key: Parameters<typeof getMenu>[0],
  label: string,
  trail?: React.ReactNode,
): SettingsPage {
  return { label, trail, url: getMenu(key).url };
}

function useSettingsPages({
  plus,
  showProfile,
  withProfile,
}: SettingsPagesShown & { withProfile: boolean }) {
  const t = useExtracted();

  const yours = [
    showProfile && withProfile && toPage("profile", t("Profile")),
    toPage(
      "appearance",
      t({
        description:
          "A page inside Settings for the buddy, sounds, daily time limit and app language: use a word other than “Settings”.",
        message: "Preferences",
      }),
    ),
    toPage("memory", t("Memory")),
  ].filter((item) => item !== false);

  const plan = [
    toPage("subscription", t("Subscription"), plus ? <PlusMark label={t("Plus")} /> : undefined),
    toPage("support", t("Help")),
  ];

  return { label: t("Settings"), plan, yours };
}

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
