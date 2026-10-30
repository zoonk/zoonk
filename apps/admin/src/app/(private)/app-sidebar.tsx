"use client";

import { Sheet, SheetContent, SheetTitle } from "@zoonk/ui/components/sheet";
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

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return adminNavigation.map((group) => (
    <SidebarSection aria-label={group.label} key={group.label} label={group.label}>
      {group.items.map(({ icon: Icon, label, url }) => (
        <SidebarTooltip key={label} label={label}>
          <Link
            aria-current={isActive(pathname, url) ? "page" : undefined}
            className={SIDEBAR_ITEM_CLASS}
            href={url}
            onNavigate={onNavigate}
            prefetch
          >
            <Icon aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
          </Link>
        </SidebarTooltip>
      ))}
    </SidebarSection>
  ));
}

function AdminSidebarContent({
  account,
  onNavigate,
  search,
  toggle,
}: {
  account: AdminAccount;
  onNavigate?: () => void;
  search?: React.ReactNode;
  toggle?: React.ReactNode;
}) {
  return (
    <>
      <SidebarHeader className="gap-4">
        <SidebarHeaderRow>
          <span className="sidebar-collapsed:hidden flex h-8 items-center px-2 text-sm font-semibold">
            Zoonk Admin
          </span>
          {toggle}
        </SidebarHeaderRow>
        {search}
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
      <AdminSidebarContent
        account={account}
        search={<SidebarSearch label="Search…" onClick={openCommandPalette} />}
        toggle={<SidebarToggle collapseLabel="Collapse sidebar" expandLabel="Expand sidebar" />}
      />
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
      <SheetContent className="gap-4 overflow-y-auto p-3 data-[side=left]:w-60" side="left">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <AdminSidebarContent account={account} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
