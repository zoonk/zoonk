import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { getExtracted } from "next-intl/server";
import { UserAvatar } from "./user-avatar";
import { UserDropdownMenu } from "./user-dropdown-menu";

export async function UserAvatarMenu() {
  const t = await getExtracted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("User menu")}
        className="rounded-full focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <UserAvatar />
      </DropdownMenuTrigger>

      <UserDropdownMenu />
    </DropdownMenu>
  );
}
