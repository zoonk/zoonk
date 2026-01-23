import { DropdownMenu, DropdownMenuTrigger } from "@zoonk/ui/components/dropdown-menu";
import { getExtracted } from "next-intl/server";
import { UserAvatar } from "./user-avatar";
import { UserDropdownMenu } from "./user-dropdown-menu";

export async function UserAvatarMenu() {
  const t = await getExtracted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("User menu")}
        className="focus-visible:border-ring focus-visible:ring-ring/50 rounded-full focus-visible:ring-[3px]"
      >
        <UserAvatar />
      </DropdownMenuTrigger>

      <UserDropdownMenu />
    </DropdownMenu>
  );
}
