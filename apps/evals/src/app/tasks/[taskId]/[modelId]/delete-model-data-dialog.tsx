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
import { Spinner } from "@zoonk/ui/components/spinner";
import { Trash2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { deleteModelDataAction } from "./actions";

/**
 * Keeps the confirmation controls locked until both filesystem stores are
 * deleted, preventing a second choice while the page redirects.
 */
function DeleteModelDataFooter() {
  const { pending } = useFormStatus();

  return (
    <AlertDialogFooter>
      <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
      <AlertDialogAction disabled={pending} type="submit" variant="destructive">
        {pending && <Spinner />}
        {pending ? "Deleting..." : "Delete Data"}
      </AlertDialogAction>
    </AlertDialogFooter>
  );
}

/**
 * Explains that deleting model data removes both generated outputs and scored
 * results before submitting the destructive server action.
 */
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
        render={<Button disabled={disabled} type="button" variant="destructive" />}
      >
        <Trash2Icon />
        Delete Outputs &amp; Results
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete outputs and results?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes every generated output and evaluation result for this model.
            You will need to generate and evaluate it again.
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
