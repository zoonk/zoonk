import { DropdownMenu, DropdownMenuTrigger } from "@zoonk/ui/components/dropdown-menu";
import { getExtracted } from "next-intl/server";
import { UserAvatar } from "./user-avatar";
import { UserDropdownMenu } from "./user-dropdown-menu";

/** The account menu, with the app's search first: a 28px avatar that's still a 44px target. */
export async function UserAvatarMenu() {
  const t = await getExtracted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("User menu")}
        className="focus-visible:border-ring focus-visible:ring-ring/50 hit-area relative size-7 shrink-0 rounded-full focus-visible:ring-[3px]"
      >
        <UserAvatar />
      </DropdownMenuTrigger>

      <UserDropdownMenu />
    </DropdownMenu>
  );
}
