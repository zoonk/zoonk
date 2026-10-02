"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarTrigger,
} from "@zoonk/ui/components/sidebar";
import {
  BarChart3Icon,
  BookOpen,
  BrainCircuitIcon,
  CpuIcon,
  CreditCardIcon,
  FileTextIcon,
  FileWarningIcon,
  GraduationCapIcon,
  HomeIcon,
  ImageIcon,
  LayersIcon,
  ListChecksIcon,
  MessageSquareTextIcon,
  MessagesSquareIcon,
  ThumbsUpIcon,
  TrophyIcon,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { AppSidebarMenuItem } from "./app-sidebar-menu-item";

const menuGroups = [
  {
    items: [
      { icon: HomeIcon, label: "Home", url: "/" },
      { icon: BarChart3Icon, label: "Stats", url: "/stats" },
      { icon: ThumbsUpIcon, label: "Feedback", url: "/feedback" },
      { icon: CpuIcon, label: "AI", url: "/ai" },
    ],
    label: "Overview",
  },
  {
    items: [
      { icon: Users, label: "Users", url: "/users" },
      { icon: TrophyIcon, label: "Leaderboard", url: "/leaderboard" },
      { icon: CreditCardIcon, label: "Subscriptions", url: "/subscriptions" },
    ],
    label: "Learners",
  },
  {
    items: [
      { icon: BookOpen, label: "Courses", url: "/courses" },
      { icon: MessageSquareTextIcon, label: "Course Prompts", url: "/course-prompts" },
      { icon: LayersIcon, label: "Lessons", url: "/lessons" },
      { icon: MessagesSquareIcon, label: "Questions", url: "/questions" },
    ],
    label: "Content",
  },
  {
    items: [
      { icon: BrainCircuitIcon, label: "Skills", url: "/skills" },
      { icon: ListChecksIcon, label: "Items", url: "/items" },
      { icon: FileTextIcon, label: "Sources", url: "/sources" },
      { icon: GraduationCapIcon, label: "Exams", url: "/exams" },
      { icon: ImageIcon, label: "Media", url: "/media" },
      { icon: FileWarningIcon, label: "Needs review", url: "/review-flags" },
    ],
    label: "Library",
  },
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
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
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
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
