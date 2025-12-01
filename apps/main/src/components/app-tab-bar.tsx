"use client";

import { TabBar, TabBarItem } from "@zoonk/ui/components/tab-bar";
import { isPathActive } from "@zoonk/utils/routing";
import { useExtracted } from "next-intl";
import { CommandPalette } from "@/components/command-palette";
import { Link, usePathname } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

export function AppTabBarItem({
  href,
  icon,
  label,
  className,
  isActive = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  className?: string;
  isActive?: boolean;
}) {
  const pathname = usePathname();
  const active = isActive || isPathActive({ href, pathname });

  return (
    <TabBarItem active={active} asChild className={className}>
      <Link href={href}>
        {icon}
        <span className="sr-only">{label}</span>
      </Link>
    </TabBarItem>
  );
}

export function AppTabBar({ active }: { active?: string }) {
  const t = useExtracted();

  const menuItems = [
    { label: t("Home"), ...getMenu("home") },
    { label: t("Courses"), ...getMenu("courses") },
    { label: t("Learn"), ...getMenu("learn") },
    { label: t("Settings"), ...getMenu("settings") },
  ];

  return (
    <TabBar action={<CommandPalette />}>
      {menuItems.map((menu) => (
        <AppTabBarItem
          href={menu.url}
          icon={<menu.icon aria-hidden="true" />}
          isActive={active === menu.url}
          key={menu.url}
          label={menu.label}
        />
      ))}
    </TabBar>
  );
}
