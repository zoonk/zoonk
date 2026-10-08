"use client";

import {
  SetupError,
  SetupField,
  SetupForm,
  SetupInput,
  SetupLabel,
  SetupSubmit,
} from "@/components/setup";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@zoonk/auth/username-rules";
import {
  type UsernameStatus,
  useUsernameAvailability,
} from "@zoonk/core/auth/hooks/username-availability";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@zoonk/ui/components/input-group";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useActionState, useId } from "react";
import { setupProfileAction } from "./actions";

/** Under the username: the rule, then whether the one typed is free as soon as it's checked. */
function UsernameDescription({
  id,
  status,
  username,
}: {
  id: string;
  status: UsernameStatus;
  username: string;
}) {
  const t = useExtracted();

  if (status === "checking") {
    return (
      <p className="text-muted-foreground flex items-center gap-1 text-sm" id={id}>
        <Spinner className="size-3" />
        {t("Checking...")}
      </p>
    );
  }

  if (status === "available") {
    return (
      <p className="text-success text-sm" id={id}>
        {t("{username} is available", { username })}
      </p>
    );
  }

  if (status === "taken") {
    return (
      <p className="text-destructive text-sm" id={id}>
        {t("{username} is already taken", { username })}
      </p>
    );
  }

  return (
    <p
      className={cn("text-sm", status === "invalid" ? "text-destructive" : "text-muted-foreground")}
      id={id}
    >
      {t("3-30 characters. Letters, numbers, and underscores only.")}
    </p>
  );
}

/**
 * A new account's name and username. The username starts from a free one made from the email, so
 * keeping it is one tap; another one is checked while it's typed.
 */
export function SetupProfileForm({
  defaultName,
  defaultUsername,
  redirectTo,
}: {
  defaultName: string;
  defaultUsername: string;
  redirectTo: string | null;
}) {
  const t = useExtracted();
  const descriptionId = useId();
  const { setUsername, status, username } = useUsernameAvailability(defaultUsername);
  const boundAction = setupProfileAction.bind(null, redirectTo);
  const [state, formAction] = useActionState(boundAction, { status: "idle" as const });
  const canSubmit = status === "idle" || status === "available";

  return (
    <SetupForm action={formAction}>
      <SetupField>
        <SetupLabel htmlFor="name">{t("Name")}</SetupLabel>
        <SetupInput
          autoComplete="name"
          // The first field, so it's ready to type on arrival.
          autoFocus
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
            aria-describedby={descriptionId}
            aria-invalid={status === "invalid" || status === "taken"}
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect="off"
            id="username"
            maxLength={USERNAME_MAX_LENGTH}
            minLength={USERNAME_MIN_LENGTH}
            name="username"
            onChange={(event) => setUsername(event.target.value)}
            required
            spellCheck={false}
            value={username}
          />
        </InputGroup>
        <UsernameDescription id={descriptionId} status={status} username={username} />
      </SetupField>

      <SetupError hasError={state.status === "usernameTaken"}>
        {t("{username} is already taken", { username })}
      </SetupError>

      <SetupError hasError={state.status === "error"}>
        {t("We couldn't save your profile. Try again.")}
      </SetupError>

      <SetupSubmit disabled={!canSubmit}>{t("Continue")}</SetupSubmit>
    </SetupForm>
  );
}
