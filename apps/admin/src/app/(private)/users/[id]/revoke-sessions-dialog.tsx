"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { revokeSessionsAction } from "./_actions/revoke-sessions";

export function RevokeSessionsDialog({
  onOpenChange,
  open,
  userId,
  userName,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  userId: string;
  userName: string;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
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
            onOpenChange(false);
          }}
        >
          <input type="hidden" name="userId" value={userId} />

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <SubmitButton className="w-auto" variant="destructive">
              Revoke sessions
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
