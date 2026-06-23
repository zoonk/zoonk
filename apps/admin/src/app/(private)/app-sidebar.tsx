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
import {
  BarChart3Icon,
  BookOpen,
  CreditCardIcon,
  HomeIcon,
  LayersIcon,
  MessageSquareTextIcon,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { AppSidebarMenuItem } from "./app-sidebar-menu-item";

const menuItems = [
  { icon: HomeIcon, label: "Home", url: "/" },
  { icon: BarChart3Icon, label: "Stats", url: "/stats" },
  { icon: Users, label: "Users", url: "/users" },
  { icon: CreditCardIcon, label: "Subscriptions", url: "/subscriptions" },
  { icon: BookOpen, label: "Courses", url: "/courses" },
  { icon: MessageSquareTextIcon, label: "Course Starts", url: "/course-start-requests" },
  { icon: LayersIcon, label: "Lessons", url: "/lessons" },
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
