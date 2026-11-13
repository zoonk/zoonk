"use client";

import { isNameChangeTooLong } from "@zoonk/auth/name-rules";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@zoonk/auth/username-rules";
import {
  type UsernameStatus as UsernameStatusType,
  useUsernameAvailability,
} from "@zoonk/core/auth/hooks/username-availability";
import { ListGroup } from "@zoonk/learn/list";
import { NameHint } from "@zoonk/learn/name-hint";
import { useChangeSaveErrorMessage } from "@zoonk/learn/save-error";
import { SettingRow } from "@zoonk/learn/setting-rows";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@zoonk/ui/components/input-group";
import { Spinner } from "@zoonk/ui/components/spinner";
import { showErrorToast, showSuccessToast } from "@zoonk/ui/components/toast";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { profileFormAction } from "./actions";

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

  if (status === "invalid") {
    return (
      <span className="text-destructive-text">
        {t("3-30 characters. Letters a–z, numbers, and underscores only.")}
      </span>
    );
  }

  return null;
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const t = useExtracted();
  const { pending } = useFormStatus();

  return (
    <Button
      busy={pending}
      disabled={disabled}
      focusableWhenDisabled
      icon={<CheckIcon aria-hidden="true" />}
      size="sm"
      type="submit"
    >
      {t("Save")}
    </Button>
  );
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

  const saveError = useChangeSaveErrorMessage();

  /** A save's answer goes in a toast, so Save and the rows under it stay where they are. */
  const tellResult = (result: typeof initialState) => {
    if (result.status === "success") {
      showSuccessToast(t("Saved."));
    } else if (result.status === "usernameTaken") {
      showErrorToast(t("{username} is already taken", { username: result.username }));
    } else if (result.status === "nameTooLong") {
      showErrorToast(t("Use 150 characters or fewer."));
    } else if (result.status === "error") {
      showErrorToast(saveError);
    }
  };

  const [state, formAction] = useActionState(
    async (previous: typeof initialState, formData: FormData) => {
      const result = await profileFormAction(previous, formData).catch(() => ({
        ...previous,
        status: "error" as const,
      }));

      tellResult(result);
      return result;
    },
    initialState,
  );

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
          description={
            // The hint's line is always there, so the field doesn't move when a hint shows.
            <span className="block min-h-lh">
              {status !== "idle" && <UsernameHint status={status} username={username} />}
            </span>
          }
          descriptionId={usernameHintId}
          label={<label htmlFor="username">{t("Username")}</label>}
          wide
        >
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>@</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              aria-describedby={status === "idle" ? undefined : usernameHintId}
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

      <div className="flex justify-end border-t pt-3">
        <SaveButton disabled={!canSave} />
      </div>
    </form>
  );
}
