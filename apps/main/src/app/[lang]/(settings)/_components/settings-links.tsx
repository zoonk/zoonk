"use client";

import {
  SECTION_NAV_ROW_CLASS,
  SectionNav,
  type SectionNavItem,
  SectionNavTile,
} from "@/components/learn/section-nav";
import { logout } from "@/lib/logout";
import { getMenu } from "@/lib/menu";
import {
  ListGroup,
  ListRowButton,
  ListRowContent,
  ListRowIcon,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "@zoonk/learn/list";
import { LogOutIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * Which settings pages apply: the profile to an account, memory to a session, guardian to a teen;
 * the way out to an account, and the plan beside "Subscription" when it's Plus.
 */
export type SettingsPagesShown = {
  plus: boolean;
  showGuardian: boolean;
  showLogout: boolean;
  showMemory: boolean;
  showProfile: boolean;
};

function toPage(key: Parameters<typeof getMenu>[0], label: string, trail?: string) {
  return { icon: getMenu(key).icon, label, trail, url: getMenu(key).url };
}

/** The settings pages in two groups: the learner's own, then the plan and help. */
function useSettingsPages({ plus, showGuardian, showMemory, showProfile }: SettingsPagesShown) {
  const t = useExtracted();

  const yours = [
    showProfile && toPage("profile", t("Profile")),
    toPage("appearance", t("Appearance")),
    showMemory && toPage("memory", t("Memory")),
    showGuardian && toPage("guardian", t("Guardian")),
  ].filter((item) => item !== false);

  const plan = [
    toPage("subscription", t("Subscription"), plus ? t("Plus") : undefined),
    toPage("support", t("Help")),
  ];

  return { label: t("Settings"), plan, yours };
}

/** "Logout" at the end of the sidebar: the account's way out. */
function SidebarLogout() {
  const t = useExtracted();

  return (
    <button
      className={`${SECTION_NAV_ROW_CLASS} hover:bg-muted/60`}
      onClick={() => void logout()}
      type="button"
    >
      <SectionNavTile icon={LogOutIcon} />
      {t("Logout")}
    </button>
  );
}

/** The settings pages beside the page from `lg`, under whose account it is, with the way out last. */
export function SettingsNavLinks({
  header,
  ...shown
}: SettingsPagesShown & { header?: React.ReactNode }) {
  const { label, plan, yours } = useSettingsPages(shown);
  const first = getMenu(shown.showProfile ? "profile" : "appearance").url;

  return (
    <SectionNav
      footer={shown.showLogout && <SidebarLogout />}
      groups={[yours, plan]}
      header={header}
      hubCurrent={{ hub: getMenu("settings").url, url: first }}
      label={label}
    />
  );
}

function SettingsGroup({ items }: { items: SectionNavItem<string>[] }) {
  return (
    <ListGroup>
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <ListRowLink href={item.url} key={item.url}>
            <ListRowIcon className="size-8 rounded-lg [&_svg]:size-4">
              <Icon />
            </ListRowIcon>
            <ListRowContent className="min-h-12 py-2.5">
              <ListRowTitle>{item.label}</ListRowTitle>
            </ListRowContent>
            {item.trail && <ListRowTrailing>{item.trail}</ListRowTrailing>}
          </ListRowLink>
        );
      })}
    </ListGroup>
  );
}

/** "Logout" as the hub's last list: the account's way out, rare, so it waits at the end. */
function LogoutGroup() {
  const t = useExtracted();

  return (
    <ListGroup>
      <ListRowButton onClick={() => void logout()}>
        <ListRowIcon className="size-8 rounded-lg [&_svg]:size-4">
          <LogOutIcon />
        </ListRowIcon>
        <ListRowContent className="min-h-12 py-2.5">
          <ListRowTitle>{t("Logout")}</ListRowTitle>
        </ListRowContent>
      </ListRowButton>
    </ListGroup>
  );
}

/** The settings hub's lists: the learner's own pages, then the plan and help, then the way out. */
export function SettingsHubLists(shown: SettingsPagesShown) {
  const { label, plan, yours } = useSettingsPages(shown);

  return (
    <nav aria-label={label} className="flex flex-col gap-6">
      <SettingsGroup items={yours} />
      <SettingsGroup items={plan} />
      {shown.showLogout && <LogoutGroup />}
    </nav>
  );
}
