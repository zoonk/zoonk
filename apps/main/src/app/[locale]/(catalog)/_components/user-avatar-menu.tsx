import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { UserAvatar } from "./user-avatar";
import { UserDropdownMenu } from "./user-dropdown-menu";

export async function UserAvatarMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <UserAvatar />
      </DropdownMenuTrigger>

      <UserDropdownMenu />
    </DropdownMenu>
  );
}
