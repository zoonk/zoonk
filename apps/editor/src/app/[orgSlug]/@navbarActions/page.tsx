import { LocaleSwitcher } from "@/components/navbar/locale-switcher";
import { LogoutMenuItem } from "@/components/navbar/logout-menu-item";
import { OrgSwitcher } from "@/components/navbar/org-switcher";
import { DropdownMenuSeparator } from "@zoonk/ui/components/dropdown-menu";

export default function NavbarActionsDefault() {
  return (
    <OrgSwitcher>
      <DropdownMenuSeparator />
      <LocaleSwitcher />
      <DropdownMenuSeparator />
      <LogoutMenuItem />
    </OrgSwitcher>
  );
}
