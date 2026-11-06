"use client";

import { useAdminFormAction } from "@/lib/use-admin-action-state";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { FieldError } from "@zoonk/ui/components/field";
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

        <RevokeSessionsForm onRevoked={() => onOpenChange(false)} userId={userId} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RevokeSessionsForm({ onRevoked, userId }: { onRevoked: () => void; userId: string }) {
  const [state, formAction] = useAdminFormAction(async (formData) => {
    await revokeSessionsAction(formData);
    onRevoked();
  });

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="userId" value={userId} />
      <FieldError key={state.submissionId}>{state.error}</FieldError>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <SubmitButton className="w-auto" variant="destructive">
          Revoke sessions
        </SubmitButton>
      </AlertDialogFooter>
    </form>
  );
}
