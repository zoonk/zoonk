"use client";

import { BAR_GLYPH_ACTION, BarActionLabel } from "@/components/bar-action";
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
import { Trash2Icon } from "lucide-react";
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
  disabled,
  modelId,
  taskId,
}: {
  disabled: boolean;
  modelId: string;
  taskId: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button {...BAR_GLYPH_ACTION} disabled={disabled} type="button" variant="destructive" />
        }
      >
        <Trash2Icon />
        <BarActionLabel>Delete results</BarActionLabel>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete outputs and results?</AlertDialogTitle>
          <AlertDialogDescription>
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
