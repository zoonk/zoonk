"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@zoonk/ui/components/dialog";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { useId, useState } from "react";
import { correctBirthAction } from "./_actions/correct-birth";

/**
 * Learners can only correct their age toward younger, so a request to be treated as older (often
 * a teen's account turning adult) comes to support. Check it before saving: it can lift a minor's
 * protections. Under 13 deletes the account.
 */
export function CorrectBirthDialog({
  birthMonth,
  birthYear,
  userId,
}: {
  birthMonth: number | null;
  birthYear: number | null;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const monthId = useId();
  const yearId = useId();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Correct age</DialogTrigger>

      <DialogContent closeLabel="Close">
        <DialogHeader>
          <DialogTitle>Correct birth month and year</DialogTitle>
          <DialogDescription>
            Learners can only make their answer younger. Save an older one only after checking the
            request, since it can lift a minor&apos;s protections. Under 13 deletes the account.
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            await correctBirthAction(formData);
            setOpen(false);
          }}
        >
          <input name="userId" type="hidden" value={userId} />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={monthId}>Month</Label>
              <Input
                defaultValue={birthMonth ?? undefined}
                id={monthId}
                max={12}
                min={1}
                name="month"
                required
                type="number"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={yearId}>Year</Label>
              <Input
                defaultValue={birthYear ?? undefined}
                id={yearId}
                name="year"
                required
                type="number"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
