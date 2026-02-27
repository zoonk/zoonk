import { LocaleSwitcher } from "@/components/navbar/locale-switcher";
import { LogoutMenuItem } from "@/components/navbar/logout-menu-item";
import { OrgSwitcher } from "@/components/navbar/org-switcher";
import { listUserOrgs } from "@zoonk/core/users/orgs/list";
import { DropdownMenuSeparator } from "@zoonk/ui/components/dropdown-menu";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Suspense } from "react";

async function OrgSwitcherWithData({ children }: React.PropsWithChildren) {
  const { data: organizations } = await listUserOrgs();

  return <OrgSwitcher organizations={organizations}>{children}</OrgSwitcher>;
}

export default function NavbarActionsDefault() {
  return (
    <Suspense fallback={<Skeleton className="h-8 w-36 rounded-full" />}>
      <OrgSwitcherWithData>
        <DropdownMenuSeparator />
        <LocaleSwitcher />
        <DropdownMenuSeparator />
        <LogoutMenuItem />
      </OrgSwitcherWithData>
    </Suspense>
  );
}
