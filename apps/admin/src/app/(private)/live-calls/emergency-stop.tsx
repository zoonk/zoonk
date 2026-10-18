"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
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
import { cn } from "@zoonk/ui/lib/utils";
import { Loader2Icon, OctagonXIcon, PhoneOffIcon } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { type EmergencyStopOutcome, runEmergencyStopAction } from "./_actions/live-call-actions";

/** Waiting on the provider can take seconds per connection, so the button says it's working. */
function ConfirmButton() {
  const status = useFormStatus();

  return (
    <Button disabled={status.pending} type="submit" variant="destructive">
      {status.pending ? <Loader2Icon className="animate-spin" /> : <OctagonXIcon />}
      Turn off and close a batch
    </Button>
  );
}

/**
 * The emergency stop is one bounded batch: new calls turn off first, then the provider is asked to
 * close some open connections, and the ones it doesn't confirm stay open. The first run asks for
 * confirmation; once it ran, the outcome says how many remain and the next batch is one click,
 * since calls are already off.
 */
export function EmergencyStop() {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<EmergencyStopOutcome | null>(null);

  return (
    <div className="flex flex-col items-start gap-3">
      <AlertDialog onOpenChange={setOpen} open={open}>
        <AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>
          <OctagonXIcon />
          Run emergency stop
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run the emergency stop?</AlertDialogTitle>
            <AlertDialogDescription>
              New calls turn off right away. Then the provider is asked to close the next batch of
              open connections; any close it doesn’t confirm stays open and listed below. Learners
              whose call closes see it end, without feedback. Turn calls back on above when it’s
              safe.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <form
            action={async () => {
              setOutcome(await runEmergencyStopAction());
              setOpen(false);
            }}
          >
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <ConfirmButton />
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <span
        aria-live="polite"
        className={cn(
          "text-xs empty:hidden",
          outcome?.error ? "text-destructive-text" : "text-muted-foreground",
        )}
      >
        {outcome?.error ?? outcome?.message}
      </span>

      {outcome?.remaining ? (
        <form action={async () => setOutcome(await runEmergencyStopAction())}>
          <AdminActionSubmitButton icon={<PhoneOffIcon />}>
            Close the next batch
          </AdminActionSubmitButton>
        </form>
      ) : null}
    </div>
  );
}
