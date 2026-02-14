"use client";

import { authClient } from "@zoonk/core/auth/client";
import { useUsernameAvailability } from "@zoonk/core/auth/hooks/username-availability";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldDynamicDescription,
  FieldError,
  FieldLabel,
} from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { useExtracted } from "next-intl";
import { useActionState, useEffect } from "react";
import { profileFormAction } from "./actions";

function UsernameStatus({ status, description }: { status: string; description: string }) {
  if (status === "checking") {
    return (
      <FieldDescription className="flex items-center gap-1">
        <Spinner className="size-3" />
        {description}
      </FieldDescription>
    );
  }

  if (status === "available") {
    return <p className="text-success text-sm">{description}</p>;
  }

  if (status === "taken" || status === "invalid") {
    return <p className="text-destructive text-sm">{description}</p>;
  }

  return <FieldDescription>{description}</FieldDescription>;
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
  const { description, setUsername, status, username } = useUsernameAvailability(currentUsername);

  const [state, formAction] = useActionState(profileFormAction, initialState);

  const currentName = state.name || session?.user.name || "";

  useEffect(() => {
    if (currentUsername && !username) {
      setUsername(currentUsername);
    }
  }, [currentUsername, username, setUsername]);

  const hasError = state.status === "error";
  const isSubmitDisabled = status === "taken" || status === "checking";

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:max-w-md">
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

          <div className="relative">
            <span
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
            >
              @
            </span>

            <Input
              autoCapitalize="none"
              autoCorrect="off"
              className="pl-7"
              disabled={isPending}
              id="username"
              maxLength={30}
              minLength={3}
              name="username"
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              required
              spellCheck={false}
              value={username}
            />
          </div>

          <UsernameStatus description={description} status={status} />
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
