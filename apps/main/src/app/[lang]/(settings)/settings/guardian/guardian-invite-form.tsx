"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { useExtracted } from "next-intl";
import { useActionState, useId, useState } from "react";
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

/**
 * Invites a parent or guardian by email. With a guardian already linked, inviting another is rare,
 * so the form waits behind one button.
 */
export function GuardianInviteForm({ hasGuardian }: { hasGuardian: boolean }) {
  const t = useExtracted();
  const emailId = useId();
  const [isOpen, setIsOpen] = useState(!hasGuardian);

  const [state, formAction] = useActionState<GuardianInviteState, FormData>(inviteGuardianAction, {
    status: "idle",
  });

  if (!isOpen) {
    return (
      <Button className="w-fit" onClick={() => setIsOpen(true)} variant="outline">
        {t("Invite another guardian")}
      </Button>
    );
  }

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
            autoFocus={hasGuardian}
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

      <SubmitButton className="w-fit">{t("Send invite")}</SubmitButton>
    </form>
  );
}
