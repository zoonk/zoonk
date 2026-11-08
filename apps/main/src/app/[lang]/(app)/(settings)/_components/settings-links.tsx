"use client";

import { SectionNav, type SectionNavItem } from "@/components/learn/section-nav";
import { logout } from "@/lib/logout";
import { getMenu } from "@/lib/menu";
import {
  ListGroup,
  ListRowBody,
  ListRowButton,
  ListRowContent,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "@zoonk/learn/list";
import { PlusMark } from "@zoonk/learn/plus-lock";
import { useFormatTimeOfDay } from "@zoonk/learn/time-format";
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
    toPage("reminders", t("Reminders")),
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
          <ListRowBody>
            <ListRowContent>
              <ListRowTitle>{item.label}</ListRowTitle>
            </ListRowContent>
            {item.trail !== null && item.trail !== undefined && (
              <ListRowTrailing className={typeof item.trail === "number" ? undefined : "font-sans"}>
                {item.trail}
              </ListRowTrailing>
            )}
          </ListRowBody>
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

type HubReminders = { on: boolean; time: string };

function useRemindersSummary(reminders: HubReminders | null | undefined): string | undefined {
  const t = useExtracted();
  const formatTime = useFormatTimeOfDay();

  if (!reminders) {
    return undefined;
  }

  return reminders.on
    ? formatTime(reminders.time)
    : t({
        description: "Study reminders are off: the value beside the Reminders row in Settings",
        id: "remindersOff",
        message: "Off",
      });
}

export function SettingsHubLists({
  memoryCount,
  preferencesSummary,
  reminders,
  ...shown
}: SettingsPagesShown & {
  memoryCount?: number;
  preferencesSummary?: React.ReactNode;
  reminders?: HubReminders | null;
}) {
  const { label, plan, yours } = useSettingsPages({ ...shown, withProfile: false });
  const remindersSummary = useRemindersSummary(reminders);

  const trails = new Map<string, React.ReactNode>([
    [getMenu("appearance").url, preferencesSummary],
    [getMenu("reminders").url, remindersSummary],
    [getMenu("memory").url, memoryCount],
  ]);

  const summaries = yours.map((item) => ({ ...item, trail: trails.get(item.url) }));

  return (
    <nav aria-label={label} className="flex flex-col gap-6">
      <SettingsGroup items={summaries} />
      <SettingsGroup items={plan} />
      {shown.showLogout && <LogoutGroup />}
    </nav>
  );
}
