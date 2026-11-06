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
import { unbanUserAction } from "./_actions/unban-user";

export function UnbanUserDialog({
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
          <AlertDialogTitle>Unban {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will restore the user&apos;s access to the platform.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <UnbanUserForm onUnbanned={() => onOpenChange(false)} userId={userId} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UnbanUserForm({ onUnbanned, userId }: { onUnbanned: () => void; userId: string }) {
  const [state, formAction] = useAdminFormAction(async (formData) => {
    await unbanUserAction(formData);
    onUnbanned();
  });

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="userId" value={userId} />
      <FieldError key={state.submissionId}>{state.error}</FieldError>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <SubmitButton className="w-auto">Unban user</SubmitButton>
      </AlertDialogFooter>
    </form>
  );
}
