"use client";

import { SidePanel, SidePanelContent, SidePanelTitle } from "@zoonk/ui/components/side-panel";
import {
  SIDEBAR_ITEM_CLASS,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarHeaderRow,
  SidebarSection,
} from "@zoonk/ui/components/sidebar";
import { SidebarSearch, SidebarToggle, SidebarTooltip } from "@zoonk/ui/components/sidebar-toggle";
import { openCommandPalette } from "@zoonk/ui/lib/command-palette-event";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type AdminAccount, AdminAccountMenu } from "./admin-account-menu";
import { adminNavigation } from "./admin-navigation";

function isActive(pathname: string, url: string) {
  if (url === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(url);
}

type AdminNavUrl = (typeof adminNavigation)[number]["items"][number]["url"];

/** What follows an item's label, such as how many content fixes wait for review. */
export type AdminNavCounts = Partial<Record<AdminNavUrl, React.ReactNode>>;

function AdminNav({ counts, onNavigate }: { counts: AdminNavCounts; onNavigate?: () => void }) {
  const pathname = usePathname();

  return adminNavigation.map((group) => (
    <SidebarSection aria-label={group.label} key={group.label} label={group.label}>
      {group.items.map(({ icon: Icon, label, url }) => (
        <SidebarTooltip
          key={label}
          label={
            <>
              {label}
              {counts[url]}
            </>
          }
        >
          <Link
            aria-current={isActive(pathname, url) ? "page" : undefined}
            className={SIDEBAR_ITEM_CLASS}
            href={url}
            onNavigate={onNavigate}
            prefetch
          >
            <Icon aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {counts[url]}
          </Link>
        </SidebarTooltip>
      ))}
    </SidebarSection>
  ));
}

type AdminSidebarProps = { account: AdminAccount; counts: AdminNavCounts };

function AdminSidebarContent({
  account,
  counts,
  onNavigate,
}: AdminSidebarProps & { onNavigate?: () => void }) {
  return (
    <>
      <AdminNav counts={counts} onNavigate={onNavigate} />

      <SidebarFooter>
        <AdminAccountMenu account={account} />
      </SidebarFooter>
    </>
  );
}

export function AppSidebar({ account, counts }: AdminSidebarProps) {
  return (
    <Sidebar aria-label="Sidebar" className="gap-4">
      <SidebarHeader className="gap-4">
        <SidebarHeaderRow>
          <SidebarToggle collapseLabel="Collapse sidebar" expandLabel="Expand sidebar" />
        </SidebarHeaderRow>
        <SidebarSearch label="Search…" onClick={openCommandPalette} />
      </SidebarHeader>

      <AdminSidebarContent account={account} counts={counts} />
    </Sidebar>
  );
}

export function AdminMenuSheet({
  account,
  counts,
  onOpenChange,
  open,
}: AdminSidebarProps & { onOpenChange: (open: boolean) => void; open: boolean }) {
  return (
    <SidePanel onOpenChange={onOpenChange} open={open}>
      <SidePanelContent className="gap-4 overflow-y-auto p-3 data-[side=left]:w-60" side="left">
        <SidePanelTitle className="sr-only">Menu</SidePanelTitle>
        <AdminSidebarContent
          account={account}
          counts={counts}
          onNavigate={() => onOpenChange(false)}
        />
      </SidePanelContent>
    </SidePanel>
  );
}
