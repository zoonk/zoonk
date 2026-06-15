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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { Loader2Icon, MailIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ComponentProps, type ReactNode, useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { type LearningGoalNotificationState } from "./learning-goal-notification-action";

type LearningGoalNotificationAction = (
  state: LearningGoalNotificationState,
  formData: FormData,
) => Promise<LearningGoalNotificationState>;

type LearningGoalNotificationFormAction = NonNullable<ComponentProps<"form">["action"]>;

const initialState: LearningGoalNotificationState = { status: "idle" };

/**
 * Uses the local form pending state so the notification submit button can
 * match the compact coming-soon actions without relying on a page-level
 * pending store.
 */
function LearningGoalNotificationSubmitButton({
  children,
  full,
  icon,
}: {
  children: ReactNode;
  full?: boolean;
  icon: ReactNode;
}) {
  const status = useFormStatus();

  return (
    <Button
      className={full ? "w-full" : undefined}
      disabled={status.pending}
      size="sm"
      type="submit"
      variant="secondary"
    >
      {status.pending ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : icon}
      {children}
    </Button>
  );
}

/**
 * Shows compact action feedback next to the notification CTA so learners know
 * their request was sent without leaving the coming-soon page.
 */
function LearningGoalNotificationStatus({ state }: { state: LearningGoalNotificationState }) {
  const t = useExtracted();

  if (state.status === "success") {
    return (
      <p aria-live="polite" className="text-success text-sm font-medium">
        {t("We'll send you an email when it's available.")}
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <p className="text-destructive text-sm font-medium" role="alert">
        {t("Failed to save your email. Please try again.")}
      </p>
    );
  }

  return null;
}

/**
 * Collects only the email address for guests because the routed goal already
 * supplies the message context the server action sends to the support inbox.
 */
function LearningGoalNotificationEmailForm({
  formAction,
  state,
}: {
  formAction: LearningGoalNotificationFormAction;
  state: LearningGoalNotificationState;
}) {
  const t = useExtracted();
  const emailId = useId();

  return (
    <form action={formAction} className="flex w-full flex-col gap-6">
      <Field>
        <FieldContent>
          <FieldLabel htmlFor={emailId}>{t("Email address")}</FieldLabel>
          <Input
            autoComplete="email"
            id={emailId}
            name="email"
            placeholder={t("myemail@gmail.com")}
            required
            type="email"
          />
          <FieldDescription>
            {t("We'll only use this email to let you know when this goal is available.")}
          </FieldDescription>
          {state.status === "error" && (
            <FieldError>{t("Failed to save your email. Please try again.")}</FieldError>
          )}
          {state.status === "success" && <LearningGoalNotificationStatus state={state} />}
        </FieldContent>
      </Field>

      <LearningGoalNotificationSubmitButton full icon={<MailIcon aria-hidden="true" />}>
        {t("Notify me")}
      </LearningGoalNotificationSubmitButton>
    </form>
  );
}

/**
 * Keeps the guest-only dialog separate from the signed-in one-click path so
 * the main component only chooses between two learner states.
 */
function LearningGoalNotificationDialog({
  formAction,
  state,
}: {
  formAction: LearningGoalNotificationFormAction;
  state: LearningGoalNotificationState;
}) {
  const t = useExtracted();

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="secondary" />}>
        <MailIcon aria-hidden="true" />
        {t("Notify me")}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Get notified")}</DialogTitle>
          <DialogDescription>
            {t("Leave your email and we'll let you know when this goal is available.")}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <LearningGoalNotificationEmailForm formAction={formAction} state={state} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Lets learners register interest in unsupported learning modes. Signed-in
 * learners get a one-click server action because the action can read their
 * session email; guests get a dialog with only the email field we need.
 */
export function LearningGoalNotification({
  action,
  defaultEmail,
}: {
  action: LearningGoalNotificationAction;
  defaultEmail?: string;
}) {
  const t = useExtracted();
  const [state, formAction] = useActionState(action, initialState);

  if (defaultEmail) {
    return (
      <div className="flex flex-col items-center gap-2">
        <form action={formAction}>
          <LearningGoalNotificationSubmitButton icon={<MailIcon aria-hidden="true" />}>
            {t("Notify me")}
          </LearningGoalNotificationSubmitButton>
        </form>

        <LearningGoalNotificationStatus state={state} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <LearningGoalNotificationDialog formAction={formAction} state={state} />
    </div>
  );
}
