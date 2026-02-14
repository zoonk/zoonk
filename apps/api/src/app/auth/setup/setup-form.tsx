"use client";

import {
  SetupError,
  SetupField,
  SetupForm,
  SetupInput,
  SetupLabel,
  SetupSubmit,
} from "@/components/setup";
import { useUsernameAvailability } from "@zoonk/core/auth/hooks/username-availability";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@zoonk/ui/components/input-group";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { setupProfileAction } from "./actions";

function UsernameDescription({ status, description }: { status: string; description: string }) {
  if (status === "checking") {
    return (
      <p className="text-muted-foreground flex items-center gap-1 text-sm">
        <Spinner className="size-3" />
        {description}
      </p>
    );
  }

  return (
    <p
      className={cn("text-sm", {
        "text-destructive": status === "taken" || status === "invalid",
        "text-muted-foreground": status === "idle",
        "text-success": status === "available",
      })}
    >
      {description}
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
  const router = useRouter();
  const t = useExtracted();
  const { description, setUsername, status, username } = useUsernameAvailability();

  const [state, formAction] = useActionState(setupProfileAction, {
    status: "idle" as const,
  });

  useEffect(() => {
    if (state.status === "success") {
      router.push(`/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`);
    }
  }, [state.status, router, redirectTo]);

  const hasError = state.status === "error";
  const isSubmitDisabled = status === "taken" || status === "checking";

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
            maxLength={30}
            minLength={3}
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
        <UsernameDescription description={description} status={status} />
      </SetupField>

      <SetupError hasError={hasError}>
        {t("Failed to set up your profile. Please try again or contact hello@zoonk.com")}
      </SetupError>

      <SetupSubmit disabled={isSubmitDisabled}>{t("Continue")}</SetupSubmit>
    </SetupForm>
  );
}
