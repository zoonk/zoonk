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
import { Label } from "@zoonk/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zoonk/ui/components/select";
import { SUBSCRIPTION_PLANS } from "@zoonk/utils/subscription";
import { useState } from "react";
import { changePlanAction } from "./_actions/change-plan";

function PlanSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (newPlan: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(newValue) => newValue && onValueChange(newValue)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        {SUBSCRIPTION_PLANS.map((plan) => (
          <SelectItem key={plan.name} value={plan.name}>
            <span className="capitalize">{plan.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ChangePlanDialog({ userId, currentPlan }: { userId: number; currentPlan: string }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(currentPlan);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Change Plan</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change subscription plan</DialogTitle>
          <DialogDescription>Manually change this user&apos;s subscription plan.</DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            await changePlanAction(formData);
            setOpen(false);
          }}
        >
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="plan" value={plan} />

          <div className="flex flex-col gap-2">
            <Label>Plan</Label>
            <PlanSelect value={plan} onValueChange={setPlan} />
          </div>

          <DialogFooter className="mt-6">
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
