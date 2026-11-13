"use client";

import { SectionNav, type SectionNavItem } from "@/components/learn/section-nav";
import { usePathname } from "@/i18n/navigation";
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
  showProfile,
  withProfile,
}: Pick<SettingsPagesShown, "showProfile"> & { withProfile: boolean }) {
  const t = useExtracted();

  const yours = [
    showProfile && withProfile && toPage("profile", t("Profile")),
    toPage(
      "appearance",
      t({
        description:
          "A page inside Settings for the buddy, sounds and app language: use a word other than “Settings”.",
        message: "Preferences",
      }),
    ),
    toPage("reminders", t("Reminders")),
    toPage("aboutYou", t("About you")),
    toPage("memory", t("Memory")),
    toPage("privacy", t("Privacy")),
  ].filter((item) => item !== false);

  const plan = [toPage("subscription", t("Subscription")), toPage("support", t("Help"))];

  return { label: t("Settings"), plan, yours };
}

/** Someone without an account who opens Profile from a link still sees its tab, marked as the page they're on. */
export function SettingsNavLinks(shown: SettingsPagesShown) {
  const onProfile = usePathname() === getMenu("profile").url;
  const showProfile = shown.showProfile || onProfile;
  const { label, plan, yours } = useSettingsPages({ ...shown, showProfile, withProfile: true });
  const first = getMenu(showProfile ? "profile" : "appearance").url;

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
            {item.trail && <ListRowTrailing className="font-sans">{item.trail}</ListRowTrailing>}
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

/** Two rows show a value: Reminders its time, and a subscriber's Subscription the plan they have. */
export function SettingsHubLists({
  reminders,
  ...shown
}: SettingsPagesShown & { reminders?: HubReminders | null }) {
  const t = useExtracted();
  const { label, plan, yours } = useSettingsPages({ ...shown, withProfile: false });
  const remindersSummary = useRemindersSummary(reminders);
  const remindersUrl = getMenu("reminders").url;
  const subscriptionUrl = getMenu("subscription").url;

  const summaries = yours.map((item) =>
    item.url === remindersUrl ? { ...item, trail: remindersSummary } : item,
  );

  const plans = plan.map((item) =>
    item.url === subscriptionUrl && shown.plus
      ? {
          ...item,
          trail: t({
            description:
              "The plan's name beside Subscription in a menu, shown only to subscribers: the plan they have.",
            id: "subscriberPlanName",
            message: "Plus",
          }),
        }
      : item,
  );

  return (
    <nav aria-label={label} className="flex flex-col gap-6">
      <SettingsGroup items={summaries} />
      <SettingsGroup items={plans} />
      {shown.showLogout && <LogoutGroup />}
    </nav>
  );
}
