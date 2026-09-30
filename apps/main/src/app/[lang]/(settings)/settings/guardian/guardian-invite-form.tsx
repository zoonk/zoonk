"use client";

import { FUN_PRIMARY_BUTTON_CLASS } from "@zoonk/learn/fun-primary";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { cn } from "@zoonk/ui/lib/utils";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { useExtracted } from "next-intl";
import { useActionState, useId } from "react";
import { type GuardianInviteState, inviteGuardianAction } from "./actions";

function InviteError({ status }: { status: GuardianInviteState["status"] }) {
  const t = useExtracted();

  if (status === "invalidEmail") {
    return <FieldError>{t("Enter your guardian's email address, not yours.")}</FieldError>;
  }

  if (status === "limitReached") {
    return <FieldError>{t("You've sent a few invites today. Try again tomorrow.")}</FieldError>;
  }

  if (status === "error") {
    return <FieldError>{t("We couldn't send the invite. Try again.")}</FieldError>;
  }

  return null;
}

/** Invites a parent or guardian by email. */
export function GuardianInviteForm({ hasGuardian }: { hasGuardian: boolean }) {
  const t = useExtracted();
  const emailId = useId();

  const [state, formAction] = useActionState<GuardianInviteState, FormData>(inviteGuardianAction, {
    status: "idle",
  });

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      key={state.status === "invited" ? "sent" : "form"}
    >
      <Field>
        <FieldContent>
          <FieldLabel htmlFor={emailId}>
            {hasGuardian ? t("Invite another guardian") : t("Your guardian's email")}
          </FieldLabel>
          <Input
            autoComplete="off"
            id={emailId}
            name="email"
            placeholder={t("parent@example.com")}
            required
            type="email"
          />
          {state.status === "invited" ? (
            <p className="text-success text-sm" role="status">
              {t("Invite sent. It works for 7 days.")}
            </p>
          ) : (
            <FieldDescription>
              {t("They get an email to accept. You can cancel the invite until then.")}
            </FieldDescription>
          )}
          <InviteError status={state.status} />
        </FieldContent>
      </Field>

      <SubmitButton className={cn("w-fit", FUN_PRIMARY_BUTTON_CLASS)}>
        {t("Send invite")}
      </SubmitButton>
    </form>
  );
}
