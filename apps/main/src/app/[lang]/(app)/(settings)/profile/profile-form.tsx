"use client";

import { isNameChangeTooLong } from "@zoonk/auth/name-rules";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@zoonk/auth/username-rules";
import {
  type UsernameStatus as UsernameStatusType,
  useUsernameAvailability,
} from "@zoonk/core/auth/hooks/username-availability";
import { ListGroup } from "@zoonk/learn/list";
import { ChangeSaveError } from "@zoonk/learn/save-error";
import { SettingRow } from "@zoonk/learn/setting-rows";
import { Button } from "@zoonk/ui/components/button";
import { FieldDynamicDescription } from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@zoonk/ui/components/input-group";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { profileFormAction } from "./actions";

function NameHint({ isTooLong }: { isTooLong: boolean }) {
  const t = useExtracted();

  if (isTooLong) {
    return <span className="text-destructive-text">{t("Use 150 characters or fewer.")}</span>;
  }

  return t("How Zoonk and your buddy call you, and the name on your certificates.");
}

function UsernameHint({ status, username }: { status: UsernameStatusType; username: string }) {
  const t = useExtracted();

  if (status === "checking") {
    return (
      <span className="inline-flex items-center gap-1">
        <Spinner className="size-3" />
        {t("Checking...")}
      </span>
    );
  }

  if (status === "available") {
    return <span className="text-success-text">{t("{username} is available", { username })}</span>;
  }

  if (status === "taken") {
    return (
      <span className="text-destructive-text">
        {t("{username} is already taken", { username })}
      </span>
    );
  }

  return (
    <span className={cn(status === "invalid" && "text-destructive-text")}>
      {t("3-30 characters. Letters a–z, numbers, and underscores only.")}
    </span>
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const t = useExtracted();
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} size="sm" type="submit">
      {pending && <Spinner aria-hidden="true" />}
      {t("Save")}
    </Button>
  );
}

function SaveError({ state }: { state: typeof initialState }) {
  const t = useExtracted();

  if (state.status === "error") {
    return <ChangeSaveError />;
  }

  if (state.status === "nameTooLong") {
    return (
      <p className="text-destructive-text text-sm" role="alert">
        {t("Use 150 characters or fewer.")}
      </p>
    );
  }

  if (state.status === "usernameTaken") {
    return (
      <p className="text-destructive-text text-sm" role="alert">
        {t("{username} is already taken", { username: state.username })}
      </p>
    );
  }

  return null;
}

type FormStatus = "error" | "idle" | "nameTooLong" | "success" | "usernameTaken";

const initialState = { status: "idle" as FormStatus, username: "" };

export function ProfileForm({
  defaultName,
  defaultUsername,
}: {
  defaultName: string;
  defaultUsername: string;
}) {
  const t = useExtracted();
  const nameHintId = useId();
  const usernameHintId = useId();
  const [state, formAction] = useActionState(profileFormAction, initialState);
  const { setUsername, status, username } = useUsernameAvailability(defaultUsername);
  const [name, setName] = useState(defaultName);

  const isNameTooLong = isNameChangeTooLong({ name, savedName: defaultName });
  const canSave = !isNameTooLong && (status === "idle" || status === "available");

  return (
    <form action={formAction} className="flex flex-col">
      <ListGroup>
        <SettingRow
          description={<NameHint isTooLong={isNameTooLong} />}
          descriptionId={nameHintId}
          label={<label htmlFor="name">{t("Name")}</label>}
          wide
        >
          <Input
            aria-describedby={nameHintId}
            aria-invalid={
              isNameTooLong || state.status === "error" || state.status === "nameTooLong"
            }
            autoComplete="name"
            id="name"
            name="name"
            onChange={(event) => setName(event.target.value)}
            required
            type="text"
            value={name}
          />
        </SettingRow>

        <SettingRow
          description={<UsernameHint status={status} username={username} />}
          descriptionId={usernameHintId}
          label={<label htmlFor="username">{t("Username")}</label>}
          wide
        >
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>@</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              aria-describedby={usernameHintId}
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
        </SettingRow>
      </ListGroup>

      <div className="flex flex-col items-end gap-2 border-t pt-3">
        <FieldDynamicDescription successMessage={state.status === "success" ? t("Saved.") : null} />
        <SaveError state={state} />
        <SaveButton disabled={!canSave} />
      </div>
    </form>
  );
}
