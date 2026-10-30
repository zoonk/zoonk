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
import { Button } from "@zoonk/ui/components/button";
import { DetailMenu } from "@zoonk/ui/components/detail";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { MergeIcon } from "lucide-react";
import { useState } from "react";
import { mergeSkillAction } from "./_actions/merge-skill";

/** A merge can't be undone from here, so it asks for the surviving skill's id and confirms first. */
export function SkillActionsMenu({ skillId }: { skillId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DetailMenu label="Skill actions">
        <DropdownMenuItem onClick={() => setOpen(true)} variant="destructive">
          <MergeIcon aria-hidden="true" />
          Merge into another skill
        </DropdownMenuItem>
      </DetailMenu>

      <AlertDialog onOpenChange={setOpen} open={open}>
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
    </>
  );
}
