"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@zoonk/ui/components/alert-dialog";
import { Button } from "@zoonk/ui/components/button";
import { useState } from "react";
import { revokeSessionsAction } from "./_actions/revoke-sessions";

export function RevokeSessionsDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        Revoke Sessions
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke all sessions?</AlertDialogTitle>
          <AlertDialogDescription>
            This will sign {userName} out of all devices.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form
          action={async (formData) => {
            await revokeSessionsAction(formData);
            setOpen(false);
          }}
        >
          <input type="hidden" name="userId" value={userId} />

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="submit" variant="destructive">
              Revoke Sessions
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
