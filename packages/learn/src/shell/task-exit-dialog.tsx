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

/**
 * What leaving asks first, when it would leave something unsent behind (an essay being written):
 * the question, what happens to the work, and the two answers, in the screen's own words.
 */
export type TaskExitConfirmation = {
  cancel: string;
  confirm: string;
  description: string;
  title: string;
};

/**
 * The question a task's ✕ asks before leaving unsent work behind. It's its own chunk
 * (`TaskFrame` loads it once a screen has work to lose), so the tasks that never ask don't
 * download a dialog.
 */
export function TaskExitDialog({
  confirmation,
  onLeave,
  onOpenChange,
  open,
}: {
  confirmation: TaskExitConfirmation;
  onLeave: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmation.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{confirmation.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onLeave}>{confirmation.confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
