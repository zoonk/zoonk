"use client";

import { Sheet, SheetContent, SheetTitle } from "@zoonk/ui/components/sheet";
import {
  SIDEBAR_ITEM_CLASS,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarSection,
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
  MessagesSquareIcon,
  PhoneIcon,
  ThumbsUpIcon,
  TrophyIcon,
  UserXIcon,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type AdminAccount, AdminAccountMenu } from "./admin-account-menu";

const menuGroups = [
  {
    items: [
      { icon: HomeIcon, label: "Home", url: "/" },
      { icon: BarChart3Icon, label: "Stats", url: "/stats" },
      { icon: ThumbsUpIcon, label: "Feedback", url: "/feedback/messages" },
      { icon: CpuIcon, label: "AI", url: "/ai" },
      { icon: PhoneIcon, label: "Live calls", url: "/live-calls" },
    ],
    label: "Overview",
  },
  {
    items: [
      { icon: Users, label: "Users", url: "/users" },
      { icon: TrophyIcon, label: "Leaderboard", url: "/leaderboard" },
      { icon: CreditCardIcon, label: "Subscriptions", url: "/subscriptions" },
      { icon: UserXIcon, label: "Account deletions", url: "/account-deletions" },
    ],
    label: "Learners",
  },
  {
    items: [
      { icon: BookOpen, label: "Courses", url: "/courses" },
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

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return menuGroups.map((group) => (
    <SidebarSection aria-label={group.label} key={group.label} label={group.label}>
      {group.items.map(({ icon: Icon, label, url }) => (
        <Link
          aria-current={isActive(pathname, url) ? "page" : undefined}
          className={SIDEBAR_ITEM_CLASS}
          href={url}
          key={label}
          onNavigate={onNavigate}
          prefetch
        >
          <Icon aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </Link>
      ))}
    </SidebarSection>
  ));
}

function AdminSidebarContent({
  account,
  onNavigate,
}: {
  account: AdminAccount;
  onNavigate?: () => void;
}) {
  return (
    <>
      <SidebarHeader>
        <span className="flex h-8 items-center px-2 text-sm font-semibold">Zoonk Admin</span>
      </SidebarHeader>

      <AdminNav onNavigate={onNavigate} />

      <SidebarFooter>
        <AdminAccountMenu account={account} />
      </SidebarFooter>
    </>
  );
}

export function AppSidebar({ account }: { account: AdminAccount }) {
  return (
    <Sidebar aria-label="Sidebar" className="gap-4">
      <AdminSidebarContent account={account} />
    </Sidebar>
  );
}

export function AdminMenuSheet({
  account,
  onOpenChange,
  open,
}: {
  account: AdminAccount;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="bg-sidebar text-sidebar-foreground gap-4 overflow-y-auto p-3 data-[side=left]:w-60"
        side="left"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <AdminSidebarContent account={account} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
