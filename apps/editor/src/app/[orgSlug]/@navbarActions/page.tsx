import { LocaleSwitcher } from "@/components/navbar/locale-switcher";
import { LogoutMenuItem } from "@/components/navbar/logout-menu-item";
import { OrgSwitcher } from "@/components/navbar/org-switcher";
import { listUserOrgs } from "@zoonk/core/users/orgs/list";
import { DropdownMenuSeparator } from "@zoonk/ui/components/dropdown-menu";

export default async function NavbarActionsDefault() {
  const { data: organizations } = await listUserOrgs();

  return (
    <OrgSwitcher organizations={organizations}>
      <DropdownMenuSeparator />
      <LocaleSwitcher />
      <DropdownMenuSeparator />
      <LogoutMenuItem />
    </OrgSwitcher>
  );
}
