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
import { useActionState, useId, useState } from "react";
import { setupProfileAction } from "./actions";

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
      <p className="text-success-text text-sm" id={id}>
        {t("{username} is available", { username })}
      </p>
    );
  }

  if (status === "taken") {
    return (
      <p className="text-destructive-text text-sm" id={id}>
        {t("{username} is already taken", { username })}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "text-sm",
        status === "invalid" ? "text-destructive-text" : "text-muted-foreground",
      )}
      id={id}
    >
      {t("3-30 characters. Letters, numbers, and underscores only.")}
    </p>
  );
}

function UsernameLine({ onChange, username }: { onChange: () => void; username: string }) {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-1 text-sm">
      <input name="username" type="hidden" value={username} />
      {t("Your username: @{username}", { username })}
      <span aria-hidden="true">{" · "}</span>
      <button
        aria-label={t("Change username")}
        className="text-foreground focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-md px-1 font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]"
        onClick={onChange}
        type="button"
      >
        {t("Change")}
      </button>
    </p>
  );
}

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
  const [isChangingUsername, setIsChangingUsername] = useState(!defaultUsername);
  const boundAction = setupProfileAction.bind(null, redirectTo);
  const [state, formAction] = useActionState(boundAction, { status: "idle" as const });
  const canSubmit = status === "idle" || status === "available";
  const showsUsernameField = isChangingUsername || state.status === "usernameTaken";

  return (
    <SetupForm action={formAction}>
      <SetupField>
        <SetupLabel htmlFor="name">{t("Name")}</SetupLabel>
        <SetupInput
          autoComplete="name"
          autoFocus
          defaultValue={defaultName}
          id="name"
          name="name"
          type="text"
        />
      </SetupField>

      {showsUsernameField ? (
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
              autoFocus={Boolean(defaultUsername)}
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
      ) : (
        <UsernameLine onChange={() => setIsChangingUsername(true)} username={username} />
      )}

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
