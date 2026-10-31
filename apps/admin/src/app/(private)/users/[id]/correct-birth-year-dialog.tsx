"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { correctBirthYearAction } from "./_actions/correct-birth-year";

export function CorrectBirthYearDialog({
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
          <AlertDialogTitle>Correct {userName}&apos;s birth year</AlertDialogTitle>
          <AlertDialogDescription>
            Learners can&apos;t change it themselves. Use the year they wrote to us. A year that
            makes them younger than 13 closes and deletes the account and refunds its website Plus
            in full.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form
          action={async (formData) => {
            await correctBirthYearAction(formData);
            onOpenChange(false);
          }}
        >
          <input type="hidden" name="userId" value={userId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="birthYear">Birth year</Label>
            <Input
              id="birthYear"
              inputMode="numeric"
              maxLength={4}
              minLength={4}
              name="birthYear"
              pattern="\d{4}"
              required
            />
          </div>

          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <SubmitButton className="w-auto">Save</SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
