"use client";

import { SidebarMenuButton, SidebarMenuItem } from "@zoonk/ui/components/sidebar";
import { type LucideIcon } from "lucide-react";
import { type Route } from "next";
import Link from "next/link";

type AppSidebarMenuItemProps<T extends string> = {
  icon: LucideIcon;
  isActive: boolean;
  label: string;
  url: Route<T>;
};

export function AppSidebarMenuItem<T extends string>({
  icon: Icon,
  isActive,
  label,
  url,
}: AppSidebarMenuItemProps<T>) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} render={<Link href={url} />}>
        <Icon aria-hidden="true" />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
