"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@zoonk/ui/components/alert-dialog";
import { Button } from "@zoonk/ui/components/button";
import { unbanUserAction } from "./_actions/unban-user";

export function UnbanUserDialog({ userId, userName }: { userId: string; userName: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        Unban User
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unban {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will restore the user&apos;s access to the platform.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form action={unbanUserAction}>
          <input type="hidden" name="userId" value={userId} />

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit">Unban User</AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
