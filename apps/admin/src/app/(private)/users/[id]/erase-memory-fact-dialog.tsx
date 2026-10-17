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
import { eraseMemoryFactAction } from "./_actions/erase-memory-fact";

/**
 * Erasing is final (unlike the learner's own delete, which keeps 30 days of undo), so it asks
 * first, like the other account actions on this page.
 */
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

        <form
          action={async (formData) => {
            await eraseMemoryFactAction(formData);
            setOpen(false);
          }}
        >
          <input name="factId" type="hidden" value={factId} />
          <input name="userId" type="hidden" value={userId} />

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="submit" variant="destructive">
              Erase
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
