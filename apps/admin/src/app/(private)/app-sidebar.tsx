"use client";

import { type InboxQueueName } from "@/data/inbox/get-inbox";
import { Sheet, SheetContent, SheetTitle } from "@zoonk/ui/components/sheet";
import {
  SIDEBAR_ITEM_CLASS,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
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

/** How many wait in each Inbox queue, drawn after its label. */
export type AdminNavCounts = Record<InboxQueueName, React.ReactNode>;

function AdminNav({ counts, onNavigate }: { counts: AdminNavCounts; onNavigate?: () => void }) {
  const pathname = usePathname();

  return adminNavigation.map((group) => (
    <SidebarSection
      aria-label={group.label ?? "Home"}
      key={group.label ?? "home"}
      label={group.label}
    >
      {group.items.map(({ icon: Icon, label, queue, url }) => {
        const count = queue ? counts[queue] : null;

        return (
          <SidebarTooltip
            key={label}
            label={
              <>
                {label}
                {count}
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
              {count}
            </Link>
          </SidebarTooltip>
        );
      })}
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

      {/* Pinned: on a short window the navigation scrolls under it. */}
      <SidebarFooter className="bg-background sticky bottom-0 -mb-3 pb-3">
        <AdminAccountMenu account={account} />
      </SidebarFooter>
    </>
  );
}

export function AppSidebar({ account, counts }: AdminSidebarProps) {
  return (
    <Sidebar aria-label="Sidebar" className="gap-3">
      {/* One row, so the whole navigation fits a laptop's height; collapsed, the toggle sits over the search. */}
      <SidebarHeader className="sidebar-collapsed:flex-col-reverse sidebar-collapsed:gap-4 flex-row items-center gap-1">
        <SidebarSearch label="Search…" onClick={openCommandPalette} />
        <SidebarToggle collapseLabel="Collapse sidebar" expandLabel="Expand sidebar" />
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
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="gap-4 overflow-y-auto p-3 data-[side=left]:w-60" side="left">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <AdminSidebarContent
          account={account}
          counts={counts}
          onNavigate={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
