"use client";

import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@zoonk/auth/username-rules";
import {
  type UsernameStatus as UsernameStatusType,
  useUsernameAvailability,
} from "@zoonk/core/auth/hooks/username-availability";
import { LIST_GROUP_CLASS } from "@zoonk/learn/list";
import { FieldDescription, FieldDynamicDescription, FieldError } from "@zoonk/ui/components/field";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { useExtracted } from "next-intl";
import { useActionState } from "react";
import { profileFormAction } from "./actions";

/**
 * A field as a row of the profile's grouped list: its label above its value, the row taking the
 * focus ring. The input fills the whole row (its text under the label), so the row is one target.
 */
const FIELD_ROW_CLASS =
  "focus-within:ring-ring/50 has-[[aria-invalid=true]]:ring-destructive/30 relative h-16 focus-within:ring-[3px] focus-within:ring-inset has-[[aria-invalid=true]]:ring-[3px] has-[[aria-invalid=true]]:ring-inset";

const FIELD_LABEL_CLASS =
  "text-muted-foreground pointer-events-none absolute top-2.5 left-4 text-xs font-medium";

const FIELD_INPUT_CLASS =
  "placeholder:text-muted-foreground absolute inset-0 size-full min-w-0 bg-transparent px-4 pt-6 pb-2 text-[0.9375rem] outline-none";

/** Under the username: the rule, then whether a new one is free as soon as it's checked. */
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
    return <p className="text-success">{t("{username} is available", { username })}</p>;
  }

  if (status === "taken") {
    return <FieldError>{t("{username} is already taken", { username })}</FieldError>;
  }

  if (status === "invalid") {
    return <FieldError>{t("3-30 characters. Letters, numbers, and underscores only.")}</FieldError>;
  }

  return (
    <FieldDescription>
      {t("3-30 characters. Letters, numbers, and underscores only.")}
    </FieldDescription>
  );
}

type FormStatus = "error" | "idle" | "success" | "usernameTaken";

const initialState = { name: "", status: "idle" as FormStatus, username: "" };

/** The learner's name and username, each saved with one button. */
export function ProfileForm({
  defaultName,
  defaultUsername,
}: {
  defaultName: string;
  defaultUsername: string;
}) {
  const t = useExtracted();
  const [state, formAction] = useActionState(profileFormAction, initialState);
  const { setUsername, status, username } = useUsernameAvailability(defaultUsername);

  const currentName = state.name || defaultName;
  const canSave = status === "idle" || status === "available";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className={LIST_GROUP_CLASS}>
        <div className={FIELD_ROW_CLASS}>
          <label className={FIELD_LABEL_CLASS} htmlFor="name">
            {t("Name")}
          </label>
          <input
            aria-invalid={state.status === "error"}
            autoComplete="name"
            className={FIELD_INPUT_CLASS}
            defaultValue={currentName}
            id="name"
            key={currentName}
            name="name"
            required
            type="text"
          />
        </div>

        <div
          className={cn(
            FIELD_ROW_CLASS,
            "before:bg-foreground/10 relative before:absolute before:top-0 before:right-0 before:left-4 before:h-px",
          )}
        >
          <label className={FIELD_LABEL_CLASS} htmlFor="username">
            {t("Username")}
          </label>
          <span
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-6 bottom-2 left-4 flex items-center text-[0.9375rem]"
          >
            @
          </span>
          <input
            aria-invalid={status === "invalid" || status === "taken"}
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect="off"
            className={cn(FIELD_INPUT_CLASS, "pl-8.5")}
            id="username"
            maxLength={USERNAME_MAX_LENGTH}
            minLength={USERNAME_MIN_LENGTH}
            name="username"
            onChange={(event) => setUsername(event.target.value)}
            required
            spellCheck={false}
            value={username}
          />
        </div>
      </div>

      <div className="text-muted-foreground px-4 text-[0.8125rem] leading-snug [&_p]:text-[0.8125rem]">
        <UsernameStatus status={status} username={username} />
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <FieldDynamicDescription successMessage={state.status === "success" ? t("Saved.") : null} />

        {state.status === "error" && (
          <FieldError>{t("We couldn't save your profile. Try again.")}</FieldError>
        )}

        {state.status === "usernameTaken" && (
          <FieldError>{t("{username} is already taken", { username: state.username })}</FieldError>
        )}

        <SubmitButton className="h-10 w-full sm:w-fit sm:px-6" disabled={!canSave}>
          {t("Save")}
        </SubmitButton>
      </div>
    </form>
  );
}

/**
 * Keeps the name and username fields in place while the learner's private defaults load.
 */
export function ProfileFormSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="mx-4 h-4 w-72 max-w-full" />
      <Skeleton className="mt-2 h-10 w-full rounded-full sm:w-24" />
    </div>
  );
}
