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
  AlertDialogTrigger,
} from "@zoonk/ui/components/alert-dialog";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { useState } from "react";

/**
 * A Server Action that throws when it fails, or one that answers `{ error }` to say why in the
 * dialog. No error closes it.
 */
type AdminConfirmAction =
  | ((formData: FormData) => Promise<void>)
  | ((formData: FormData) => Promise<{ error: string | null }>);

type ConfirmFormProps = {
  action: AdminConfirmAction;
  /** What the action reads: hidden inputs, a reason, a picked target. */
  children?: React.ReactNode;
  confirmDisabled?: boolean;
  /** The verb alone, the one the title asks about: "Ban", "Reset", "Rewrite". */
  confirmLabel: string;
  /** For what destroys, locks someone out or can't be undone. */
  destructive?: boolean;
  /** Runs once the action succeeded, as the dialog closes: where the page says what it started. */
  onConfirmed?: () => void;
};

/**
 * Asks before anything that spends money, discards work, signs people out or can't be undone. The
 * title names the object ("Ban Ana Souza?") and the description says the consequence in one
 * sentence. It opens from `trigger`, or from `open` when a menu item opens it.
 */
export function AdminConfirmDialog({
  description,
  onOpenChange,
  open,
  title,
  trigger,
  ...form
}: ConfirmFormProps & {
  description: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  title: string;
  trigger?: React.ReactElement;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const setOpen = onOpenChange ?? setOwnOpen;

  return (
    <AlertDialog onOpenChange={setOpen} open={open ?? ownOpen}>
      {trigger ? <AlertDialogTrigger render={trigger} /> : null}

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <ConfirmForm
          {...form}
          onConfirmed={() => {
            form.onConfirmed?.();
            setOpen(false);
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmForm({
  action,
  children,
  confirmDisabled = false,
  confirmLabel,
  destructive = false,
  onConfirmed,
}: ConfirmFormProps & { onConfirmed: () => void }) {
  const [state, formAction] = useAdminActionState<AdminActionState>({
    action: async (previous, formData) => {
      const result = await action(formData);
      const error = typeof result === "object" ? result.error : null;

      if (!error) {
        onConfirmed();
      }

      return { error, submissionId: previous.submissionId + 1 };
    },
    initialState: { error: null, submissionId: 0 },
    report: "inline",
  });

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {children}

      <div className="-mt-3 flex flex-col gap-2">
        {/* Always a line tall, so the dialog doesn't grow when the action fails. */}
        <p
          aria-live="polite"
          className="text-destructive-text min-h-4 text-xs"
          key={state.submissionId}
        >
          {state.error}
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <SubmitButton
            className="w-auto"
            disabled={confirmDisabled}
            variant={destructive ? "destructive" : "default"}
          >
            {confirmLabel}
          </SubmitButton>
        </AlertDialogFooter>
      </div>
    </form>
  );
}
