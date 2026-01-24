"use client";

import { authClient } from "@zoonk/core/auth/client";
import {
  Field,
  FieldContent,
  FieldDynamicDescription,
  FieldError,
  FieldLabel,
} from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { useExtracted } from "next-intl";
import { useActionState } from "react";
import { nameFormAction } from "./actions";

const initialState: {
  status: "idle" | "error" | "success";
  name: string;
} = {
  name: "",
  status: "idle",
};

export function NameForm() {
  const { data: session, isPending } = authClient.useSession();
  const t = useExtracted();

  const [state, formAction] = useActionState(nameFormAction, initialState);

  const currentName = (state.name ?? session?.user.name) ?? "";
  const hasError = state.status === "error";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Field>
        <FieldContent>
          <FieldLabel htmlFor="name">{t("Name")}</FieldLabel>
          <Input
            aria-invalid={hasError}
            defaultValue={currentName}
            disabled={isPending}
            id="name"
            key={currentName}
            name="name"
            required
            type="text"
          />

          <FieldDynamicDescription
            successMessage={
              state.status === "success" ? t("Your name has been updated successfully!") : null
            }
          >
            {t("This name will be visible to other users.")}
          </FieldDynamicDescription>

          {hasError && (
            <FieldError>
              {t("Failed to update your name. Please try again or contact hello@zoonk.com")}
            </FieldError>
          )}
        </FieldContent>
      </Field>

      <SubmitButton className="w-fit">{t("Update name")}</SubmitButton>
    </form>
  );
}
