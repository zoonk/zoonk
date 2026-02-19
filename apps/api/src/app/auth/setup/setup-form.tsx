"use client";

import {
  SetupError,
  SetupField,
  SetupForm,
  SetupInput,
  SetupLabel,
  SetupSubmit,
} from "@/components/setup";
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  type UsernameStatus,
  useUsernameAvailability,
} from "@zoonk/core/auth/hooks/username-availability";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@zoonk/ui/components/input-group";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useActionState } from "react";
import { setupProfileAction } from "./actions";

function UsernameDescription({ status, username }: { status: UsernameStatus; username: string }) {
  const t = useExtracted();

  if (status === "checking") {
    return (
      <p className="text-muted-foreground flex items-center gap-1 text-sm">
        <Spinner className="size-3" />
        {t("Checking...")}
      </p>
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

  return (
    <p
      className={cn("text-sm", {
        "text-destructive": status === "invalid",
        "text-muted-foreground": status === "idle",
      })}
    >
      {t("3-30 characters. Letters, numbers, underscores, and dots only.")}
    </p>
  );
}

export function SetupProfileForm({
  defaultName,
  redirectTo,
}: {
  defaultName: string;
  redirectTo: string;
}) {
  const t = useExtracted();
  const { setUsername, status, username } = useUsernameAvailability();

  const boundAction = setupProfileAction.bind(null, redirectTo);
  const [state, formAction] = useActionState(boundAction, {
    status: "idle" as const,
  });

  const hasError = state.status === "error";
  const isSubmitDisabled = status !== "idle" && status !== "available";

  return (
    <SetupForm action={formAction}>
      <SetupField>
        <SetupLabel htmlFor="name">{t("Name")}</SetupLabel>
        <SetupInput
          autoComplete="name"
          defaultValue={defaultName}
          id="name"
          name="name"
          type="text"
        />
      </SetupField>

      <SetupField>
        <SetupLabel htmlFor="username">{t("Username")}</SetupLabel>
        <InputGroup>
          <InputGroupAddon>@</InputGroupAddon>

          <InputGroupInput
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect="off"
            id="username"
            maxLength={USERNAME_MAX_LENGTH}
            minLength={USERNAME_MIN_LENGTH}
            name="username"
            onChange={(event) => {
              event.target.value = event.target.value.toLowerCase();
              setUsername(event.target.value);
            }}
            placeholder={t("your-username")}
            required
            spellCheck={false}
            value={username}
          />
        </InputGroup>
        <UsernameDescription status={status} username={username} />
      </SetupField>

      <SetupError hasError={hasError}>
        {t("Failed to set up your profile. Please try again or contact hello@zoonk.com")}
      </SetupError>

      <SetupSubmit disabled={isSubmitDisabled}>{t("Continue")}</SetupSubmit>
    </SetupForm>
  );
}
