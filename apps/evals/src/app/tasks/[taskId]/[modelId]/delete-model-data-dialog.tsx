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
} from "@zoonk/ui/components/alert-dialog";
import { useFormStatus } from "react-dom";
import { deleteModelDataAction } from "./actions";

function DeleteModelDataFooter() {
  const { pending } = useFormStatus();

  return (
    <AlertDialogFooter>
      <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
      <AlertDialogAction busy={pending} type="submit" variant="destructive">
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  );
}

export function DeleteModelDataDialog({
  modelId,
  taskId,
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
  taskId: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete outputs and results?</AlertDialogTitle>
          <AlertDialogDescription className="text-pretty">
            Every output and result of this model on this task is deleted for good. To score it
            again, you generate and evaluate from the start.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form action={deleteModelDataAction}>
          <input name="taskId" type="hidden" value={taskId} />
          <input name="modelId" type="hidden" value={modelId} />

          <DeleteModelDataFooter />
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
