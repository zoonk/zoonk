"use client";

import { DetailMenu } from "@zoonk/ui/components/detail";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { BanIcon, LogOutIcon, UserCheckIcon } from "lucide-react";
import { useState } from "react";
import { BanUserDialog } from "./ban-user-dialog";
import { RevokeSessionsDialog } from "./revoke-sessions-dialog";
import { UnbanUserDialog } from "./unban-user-dialog";

type UserDialog = "ban" | "revoke" | "unban";

export function UserActionsMenu({
  banned,
  userId,
  userName,
}: {
  banned: boolean;
  userId: string;
  userName: string;
}) {
  const [dialog, setDialog] = useState<UserDialog | null>(null);

  const dialogProps = (name: UserDialog) => ({
    onOpenChange: (open: boolean) => setDialog(open ? name : null),
    open: dialog === name,
    userId,
    userName,
  });

  return (
    <>
      <DetailMenu label="User actions">
        <DropdownMenuItem onClick={() => setDialog("revoke")}>
          <LogOutIcon aria-hidden="true" />
          Revoke sessions
        </DropdownMenuItem>

        {banned ? (
          <DropdownMenuItem onClick={() => setDialog("unban")}>
            <UserCheckIcon aria-hidden="true" />
            Unban user
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => setDialog("ban")} variant="destructive">
            <BanIcon aria-hidden="true" />
            Ban user
          </DropdownMenuItem>
        )}
      </DetailMenu>

      <RevokeSessionsDialog {...dialogProps("revoke")} />
      <BanUserDialog {...dialogProps("ban")} />
      <UnbanUserDialog {...dialogProps("unban")} />
    </>
  );
}
