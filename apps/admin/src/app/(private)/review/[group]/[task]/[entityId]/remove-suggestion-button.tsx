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
import { useTransition } from "react";
import { removeCourseSuggestionAction } from "./_actions/course-suggestion";

export function RemoveSuggestionButton({
  searchPromptId,
  courseSuggestionId,
}: {
  searchPromptId: number;
  courseSuggestionId: number;
}) {
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("searchPromptId", String(searchPromptId));
      formData.append("courseSuggestionId", String(courseSuggestionId));
      await removeCourseSuggestionAction(formData);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" disabled={pending} type="button">
            Remove
          </Button>
        }
      />

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove suggestion</AlertDialogTitle>
          <AlertDialogDescription>
            This will unlink this suggestion from the search prompt. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleRemove}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
