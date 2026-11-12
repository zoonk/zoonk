"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { DetailMenu } from "@zoonk/ui/components/detail";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { Textarea } from "@zoonk/ui/components/textarea";
import { BanIcon, ChartNoAxesColumnIcon, LogOutIcon, UserCheckIcon } from "lucide-react";
import { useState } from "react";
import { banUserAction } from "./_actions/ban-user";
import { revokeSessionsAction } from "./_actions/revoke-sessions";
import { unbanUserAction } from "./_actions/unban-user";
import { updateUserAnalyticsDisabledAction } from "./_actions/update-user-analytics-disabled";

type UserDialog = "analytics" | "ban" | "signOut" | "unban";

export function UserActionsMenu({
  analyticsDisabled,
  banned,
  userId,
  userName,
}: {
  analyticsDisabled: boolean;
  banned: boolean;
  userId: string;
  userName: string;
}) {
  const [dialog, setDialog] = useState<UserDialog | null>(null);

  const dialogProps = (name: UserDialog) => ({
    onOpenChange: (open: boolean) => setDialog(open ? name : null),
    open: dialog === name,
  });

  const userField = <input name="userId" type="hidden" value={userId} />;

  return (
    <>
      <DetailMenu label="User actions">
        <DropdownMenuItem onClick={() => setDialog("signOut")}>
          <LogOutIcon aria-hidden="true" />
          Sign out everywhere
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setDialog("analytics")}>
          <ChartNoAxesColumnIcon aria-hidden="true" />
          {analyticsDisabled ? "Include in analytics" : "Exclude from analytics"}
        </DropdownMenuItem>

        {banned ? (
          <DropdownMenuItem onClick={() => setDialog("unban")}>
            <UserCheckIcon aria-hidden="true" />
            Unban
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => setDialog("ban")} variant="destructive">
            <BanIcon aria-hidden="true" />
            Ban
          </DropdownMenuItem>
        )}
      </DetailMenu>

      <AdminConfirmDialog
        {...dialogProps("signOut")}
        action={revokeSessionsAction}
        confirmLabel="Sign out"
        description="They'll need to sign in again on every device."
        title={`Sign ${userName} out everywhere?`}
      >
        {userField}
      </AdminConfirmDialog>

      <AdminConfirmDialog
        {...dialogProps("analytics")}
        action={updateUserAnalyticsDisabledAction}
        confirmLabel={analyticsDisabled ? "Include" : "Exclude"}
        description={
          analyticsDisabled
            ? "Their activity counts in Stats and Home again."
            : "Their activity stops counting in Stats and Home. Use it for staff and test accounts."
        }
        title={
          analyticsDisabled
            ? `Include ${userName} in analytics?`
            : `Exclude ${userName} from analytics?`
        }
      >
        {userField}
        <input name="analyticsDisabled" type="hidden" value={String(!analyticsDisabled)} />
      </AdminConfirmDialog>

      <AdminConfirmDialog
        {...dialogProps("unban")}
        action={unbanUserAction}
        confirmLabel="Unban"
        description="They can sign in again."
        title={`Unban ${userName}?`}
      >
        {userField}
      </AdminConfirmDialog>

      <AdminConfirmDialog
        {...dialogProps("ban")}
        action={banUserAction}
        confirmLabel="Ban"
        description="They're signed out everywhere and can't sign back in until you unban them."
        destructive
        title={`Ban ${userName}?`}
      >
        {userField}
        <BanFields />
      </AdminConfirmDialog>
    </>
  );
}

function BanFields() {
  // React resets uncontrolled fields after a form action, and a failed ban keeps what was typed.
  const [reason, setReason] = useState("");
  const [expires, setExpires] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="reason">Reason (optional)</Label>
        <Textarea
          id="reason"
          name="reason"
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="expires">Ends on (optional)</Label>
        <Input
          id="expires"
          name="expires"
          onChange={(event) => setExpires(event.target.value)}
          type="date"
          value={expires}
        />
      </div>
    </div>
  );
}
