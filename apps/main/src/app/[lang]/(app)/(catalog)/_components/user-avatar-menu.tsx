"use client";

import { DropdownMenu, DropdownMenuTrigger } from "@zoonk/ui/components/dropdown-menu";
import { useExtracted } from "next-intl";
import { LearnerAvatar } from "./user-avatar";
import { UserDropdownMenu } from "./user-dropdown-menu";

/** The account menu, with the app's search first: a 28px avatar that's still a 44px target. */
export function UserAvatarMenu() {
  const t = useExtracted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("User menu")}
        className="focus-visible:border-ring focus-visible:ring-ring/50 hit-area relative size-7 shrink-0 rounded-full focus-visible:ring-[3px]"
      >
        <LearnerAvatar />
      </DropdownMenuTrigger>

      <UserDropdownMenu />
    </DropdownMenu>
  );
}
