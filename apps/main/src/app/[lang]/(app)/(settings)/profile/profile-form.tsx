"use client";

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
import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { profileFormAction } from "./actions";

/** Under the username: the rule, then whether a new one is free as soon as it's checked. */
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
      {t("3-30 characters. Letters, numbers, and underscores only.")}
    </span>
  );
}

/** Save, small, at the end of the fields; busy while the profile is on its way. */
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

/** Why the last save didn't go through, over the button; "Saved." shows there for a moment. */
function SaveError({ state }: { state: typeof initialState }) {
  const t = useExtracted();

  if (state.status === "error") {
    return <ChangeSaveError />;
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

type FormStatus = "error" | "idle" | "success" | "usernameTaken";

const initialState = { name: "", status: "idle" as FormStatus, username: "" };

/**
 * The learner's name and username as two rows of the account's list, each name with what it is
 * on the left and its field on the right (under it on a phone), the username's rule (and whether a
 * new one is free) under its name, then Save at the list's end.
 */
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

  const currentName = state.name || defaultName;
  const canSave = status === "idle" || status === "available";

  return (
    <form action={formAction} className="flex flex-col">
      <ListGroup>
        <SettingRow
          description={t("How Zoonk and your buddy call you")}
          descriptionId={nameHintId}
          label={<label htmlFor="name">{t("Name")}</label>}
          wide
        >
          <Input
            aria-describedby={nameHintId}
            aria-invalid={state.status === "error"}
            autoComplete="name"
            defaultValue={currentName}
            id="name"
            key={currentName}
            name="name"
            required
            type="text"
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
