"use client";

import { AuthField, AuthForm, AuthStatus, AuthSubmit } from "@/components/auth-form";
import { isNameChangeTooLong } from "@zoonk/auth/name-rules";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { useExtracted } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { useActionState, useId, useState } from "react";
import { type SetupState, setupProfileAction } from "./actions";

export function SetupProfileForm({
  defaultName,
  redirectTo,
}: {
  defaultName: string;
  redirectTo: string | null;
}) {
  const t = useExtracted();
  const statusId = useId();
  const [name, setName] = useState(defaultName);

  const [state, formAction] = useActionState<SetupState, FormData>(
    (previous, formData) =>
      setupProfileAction(redirectTo, previous, formData).catch((error: unknown): SetupState => {
        unstable_rethrow(error);
        return { status: "error" };
      }),
    { status: "idle" },
  );

  const isNameTooLong = isNameChangeTooLong({ name, savedName: defaultName });
  const tellsNameTooLong = isNameTooLong || state.status === "nameTooLong";

  const failure = state.status === "error" ? t("We couldn't save your profile. Try again.") : "";

  return (
    <AuthForm action={formAction}>
      <AuthField>
        <Label htmlFor="name">{t("Name")}</Label>
        <Input
          aria-describedby={statusId}
          aria-invalid={tellsNameTooLong}
          autoComplete="name"
          autoFocus
          id="name"
          name="name"
          onChange={(event) => setName(event.target.value)}
          required
          type="text"
          value={name}
        />
      </AuthField>

      <AuthStatus id={statusId}>
        {tellsNameTooLong ? t("Use 150 characters or fewer.") : failure}
      </AuthStatus>

      <AuthSubmit disabled={isNameTooLong}>{t("Continue")}</AuthSubmit>
    </AuthForm>
  );
}
