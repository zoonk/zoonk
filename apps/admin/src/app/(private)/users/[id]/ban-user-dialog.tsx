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
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { Textarea } from "@zoonk/ui/components/textarea";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { useState } from "react";
import { banUserAction } from "./_actions/ban-user";

export function BanUserDialog({
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
          <AlertDialogTitle>Ban {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will prevent the user from accessing the platform.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <BanUserForm onBanned={() => onOpenChange(false)} userId={userId} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BanUserForm({ onBanned, userId }: { onBanned: () => void; userId: string }) {
  // React resets uncontrolled fields after a form action, and a failed ban keeps what was typed.
  const [reason, setReason] = useState("");
  const [expires, setExpires] = useState("");

  const [state, formAction] = useAdminFormAction(async (formData) => {
    await banUserAction(formData);
    onBanned();
  });

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="userId" value={userId} />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reason">Reason (optional)</Label>
          <Textarea
            id="reason"
            name="reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for banning…"
            value={reason}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="expires">Expires (optional)</Label>
          <Input
            id="expires"
            name="expires"
            onChange={(event) => setExpires(event.target.value)}
            type="date"
            value={expires}
          />
        </div>
      </div>

      <FieldError key={state.submissionId}>{state.error}</FieldError>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <SubmitButton className="w-auto" variant="destructive">
          Ban user
        </SubmitButton>
      </AlertDialogFooter>
    </form>
  );
}
