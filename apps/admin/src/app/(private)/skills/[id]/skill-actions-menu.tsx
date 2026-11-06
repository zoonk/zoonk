"use client";

import { type AdminActionState, useAdminActionState } from "@/lib/use-admin-action-state";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { DetailMenu } from "@zoonk/ui/components/detail";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { FieldError } from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
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

          <MergeSkillForm onMerged={() => setOpen(false)} skillId={skillId} />
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MergeSkillForm({ onMerged, skillId }: { onMerged: () => void; skillId: string }) {
  // React resets uncontrolled fields after a form action, and a failed merge keeps the id to fix.
  const [survivorId, setSurvivorId] = useState("");

  const [state, formAction] = useAdminActionState<AdminActionState>({
    action: async (previous, formData) => {
      const merged = await mergeSkillAction(previous, formData);

      if (!merged.error) {
        onMerged();
      }

      return merged;
    },
    initialState: { error: null, submissionId: 0 },
  });

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input name="duplicateId" type="hidden" value={skillId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="survivorId">Surviving skill id</Label>
        <Input
          id="survivorId"
          name="survivorId"
          onChange={(event) => setSurvivorId(event.target.value)}
          required
          value={survivorId}
        />
      </div>

      <FieldError key={state.submissionId}>{state.error}</FieldError>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <SubmitButton className="w-auto" variant="destructive">
          Merge
        </SubmitButton>
      </AlertDialogFooter>
    </form>
  );
}
