import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { UserAvatar } from "./user-avatar";
import { UserDropdownMenu } from "./user-dropdown-menu";

export async function UserAvatarMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <UserAvatar />
      </DropdownMenuTrigger>

      <UserDropdownMenu />
    </DropdownMenu>
  );
}
