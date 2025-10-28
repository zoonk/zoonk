"use client";

import { Input, InputError, InputSuccess } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { authClient } from "@/lib/auth/client";

import { nameFormAction } from "./actions";

type NameFormState = {
  status: "idle" | "error" | "success";
  name: string;
};

const initialState: NameFormState = {
  name: "",
  status: "idle",
};

export function NameForm() {
  const { data: session, isPending } = authClient.useSession();
  const t = useTranslations("Name");

  const [state, formAction] = useActionState(nameFormAction, initialState);

  const currentName = state.name || session?.user.name || "";

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <div className="flex max-w-md flex-col gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input
          defaultValue={currentName}
          disabled={isPending}
          id="name"
          key={currentName}
          name="name"
          required
          type="text"
        />
      </div>

      {state.status === "error" && <InputError>{t("error")}</InputError>}

      {state.status === "success" && (
        <InputSuccess>{t("success")}</InputSuccess>
      )}

      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}
