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
  AlertDialogTrigger,
} from "@zoonk/ui/components/alert-dialog";
import { Button } from "@zoonk/ui/components/button";
import { FieldError } from "@zoonk/ui/components/field";
import { useState } from "react";
import { eraseMemoryFactAction } from "./_actions/erase-memory-fact";

/** Erasing is final, unlike the learner's own delete, which keeps 30 days of undo. */
export function EraseMemoryFactDialog({ factId, userId }: { factId: string; userId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger render={<Button size="sm" variant="outline" />}>Erase</AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Erase this fact?</AlertDialogTitle>
          <AlertDialogDescription>
            The fact and the older facts it replaced are removed for good. Use this for support
            requests to delete personal data.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <EraseMemoryFactForm factId={factId} onErased={() => setOpen(false)} userId={userId} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EraseMemoryFactForm({
  factId,
  onErased,
  userId,
}: {
  factId: string;
  onErased: () => void;
  userId: string;
}) {
  const [state, formAction] = useAdminFormAction(async (formData) => {
    await eraseMemoryFactAction(formData);
    onErased();
  });

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input name="factId" type="hidden" value={factId} />
      <input name="userId" type="hidden" value={userId} />
      <FieldError key={state.submissionId}>{state.error}</FieldError>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <Button type="submit" variant="destructive">
          Erase
        </Button>
      </AlertDialogFooter>
    </form>
  );
}
