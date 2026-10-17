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
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { useState } from "react";
import { mergeSkillAction } from "./_actions/merge-skill";

/**
 * A merge can't be undone from here (the duplicate only points at the survivor from then on), so
 * it asks for the surviving skill's id and confirms first.
 */
export function MergeSkillDialog({ skillId }: { skillId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger render={<Button size="sm" variant="outline" />}>
        Merge into another skill
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Merge this duplicate?</AlertDialogTitle>
          <AlertDialogDescription>
            Learners&apos; mastery, answers, mistakes and plans, and the lessons, questions and
            prerequisites that name this skill move to the skill you enter. This skill then points
            at it and is never offered again.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form
          action={async (formData) => {
            await mergeSkillAction(formData);
            setOpen(false);
          }}
        >
          <input name="duplicateId" type="hidden" value={skillId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="survivorId">Surviving skill id</Label>
            <Input id="survivorId" name="survivorId" required />
          </div>

          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="submit" variant="destructive">
              Merge
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
