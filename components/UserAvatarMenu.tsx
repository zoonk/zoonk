import { UserAvatar } from "./UserAvatar";
import { UserDropdownMenu } from "./UserDropdownMenu";
import { DropdownMenu, DropdownMenuTrigger } from "./ui/dropdown-menu";

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
