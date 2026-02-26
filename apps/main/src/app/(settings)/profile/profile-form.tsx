"use client";

import { authClient } from "@zoonk/core/auth/client";
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  type UsernameStatus as UsernameStatusType,
  useUsernameAvailability,
} from "@zoonk/core/auth/hooks/username-availability";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldDynamicDescription,
  FieldError,
  FieldLabel,
} from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@zoonk/ui/components/input-group";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { useExtracted } from "next-intl";
import { useActionState } from "react";
import { profileFormAction } from "./actions";

function UsernameStatus({ status, username }: { status: UsernameStatusType; username: string }) {
  const t = useExtracted();

  if (status === "checking") {
    return (
      <FieldDescription className="flex items-center gap-1">
        <Spinner className="size-3" />
        {t("Checking...")}
      </FieldDescription>
    );
  }

  if (status === "available") {
    return <p className="text-success text-sm">{t("{username} is available", { username })}</p>;
  }

  if (status === "taken") {
    return (
      <p className="text-destructive text-sm">{t("{username} is already taken", { username })}</p>
    );
  }

  if (status === "invalid") {
    return (
      <p className="text-destructive text-sm">
        {t("3-30 characters. Letters, numbers, and underscores only.")}
      </p>
    );
  }

  return (
    <FieldDescription>
      {t("3-30 characters. Letters, numbers, and underscores only.")}
    </FieldDescription>
  );
}

const initialState = {
  name: "",
  status: "idle" as "idle" | "error" | "success",
  username: "",
};

export function ProfileForm() {
  const { data: session, isPending } = authClient.useSession();
  const t = useExtracted();

  const currentUsername = session?.user.username ?? "";
  const { setUsername, status, username } = useUsernameAvailability(currentUsername);

  const [state, formAction] = useActionState(profileFormAction, initialState);

  const currentName = state.name || session?.user.name || "";

  const hasError = state.status === "error";
  const isSubmitDisabled = status !== "idle" && status !== "available";

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:max-w-md">
      <Field>
        <FieldContent>
          <FieldLabel htmlFor="name">{t("Name")}</FieldLabel>
          <Input
            aria-invalid={hasError}
            autoComplete="name"
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
              state.status === "success" ? t("Your profile has been updated successfully!") : null
            }
          >
            {t("This name will be visible to other users.")}
          </FieldDynamicDescription>

          {hasError && (
            <FieldError>
              {t("Failed to update your profile. Please try again or contact hello@zoonk.com")}
            </FieldError>
          )}
        </FieldContent>
      </Field>

      <Field>
        <FieldContent>
          <FieldLabel htmlFor="username">{t("Username")}</FieldLabel>

          <InputGroup>
            <InputGroupAddon>@</InputGroupAddon>

            <InputGroupInput
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect="off"
              disabled={isPending}
              id="username"
              maxLength={USERNAME_MAX_LENGTH}
              minLength={USERNAME_MIN_LENGTH}
              name="username"
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              required
              spellCheck={false}
              value={username}
            />
          </InputGroup>

          <UsernameStatus status={status} username={username} />
        </FieldContent>
      </Field>

      <SubmitButton
        className={cn("w-fit", { "opacity-50": isSubmitDisabled })}
        disabled={isSubmitDisabled}
      >
        {t("Save changes")}
      </SubmitButton>
    </form>
  );
}
