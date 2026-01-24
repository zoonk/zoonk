"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarTrigger,
} from "@zoonk/ui/components/sidebar";
import { BookOpen, HomeIcon, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { AppSidebarMenuItem } from "./app-sidebar-menu-item";

const menuItems = [
  { icon: HomeIcon, label: "Home", url: "/" },
  { icon: Users, label: "Users", url: "/users" },
  { icon: BookOpen, label: "Courses", url: "/courses" },
] as const;

function isActive(pathname: string, url: string) {
  if (url === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(url);
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarTrigger />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <AppSidebarMenuItem
                  icon={item.icon}
                  isActive={isActive(pathname, item.url)}
                  key={item.label}
                  label={item.label}
                  url={item.url}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
