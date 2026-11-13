"use client";

import { isNameChangeTooLong } from "@zoonk/auth/name-rules";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@zoonk/auth/username-rules";
import {
  type UsernameStatus as UsernameStatusType,
  useUsernameAvailability,
} from "@zoonk/core/auth/hooks/username-availability";
import { EnterButton } from "@zoonk/learn/enter-button";
import { ListGroup } from "@zoonk/learn/list";
import { NameHint } from "@zoonk/learn/name-hint";
import { useChangeSaveErrorMessage } from "@zoonk/learn/save-error";
import { SettingRow } from "@zoonk/learn/setting-rows";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Input } from "@zoonk/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@zoonk/ui/components/input-group";
import { Spinner } from "@zoonk/ui/components/spinner";
import { showErrorToast, showSuccessToast } from "@zoonk/ui/components/toast";
import { useExtracted } from "next-intl";
import { useActionState, useId, useState } from "react";
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

  return (
    <span className={status === "invalid" ? "text-destructive-text" : undefined}>
      {t("3-30 characters. Letters a–z, numbers, and underscores only.")}
    </span>
  );
}

function UsernameInput({
  describedBy,
  invalid,
  onChange,
  value,
}: {
  describedBy: string;
  invalid: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>@</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        aria-describedby={describedBy}
        aria-invalid={invalid}
        autoCapitalize="none"
        autoComplete="username"
        autoCorrect="off"
        id="username"
        maxLength={USERNAME_MAX_LENGTH}
        minLength={USERNAME_MIN_LENGTH}
        name="username"
        onChange={(event) => onChange(event.target.value)}
        required
        spellCheck={false}
        value={value}
      />
    </InputGroup>
  );
}

type FormStatus = "error" | "idle" | "nameTooLong" | "success" | "usernameTaken";

const initialState = { status: "idle" as FormStatus, username: "" };

/** `children` sit between the fields and the bar, whose Save belongs to the fields alone. */
export function ProfileForm({
  children,
  defaultName,
  defaultUsername,
}: {
  children?: React.ReactNode;
  defaultName: string;
  defaultUsername: string;
}) {
  const t = useExtracted();
  const formId = useId();
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

  const [state, formAction, isSaving] = useActionState(
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
    <>
      <form action={formAction} className="flex flex-col" id={formId}>
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
            <UsernameInput
              describedBy={usernameHintId}
              invalid={status === "invalid" || status === "taken"}
              onChange={setUsername}
              value={username}
            />
          </SettingRow>
        </ListGroup>
      </form>

      {children}

      <BottomBar>
        <BottomBarActions>
          <EnterButton busy={isSaving} disabled={!canSave} enter="host" form={formId} type="submit">
            {t("Save")}
          </EnterButton>
        </BottomBarActions>
      </BottomBar>
    </>
  );
}
