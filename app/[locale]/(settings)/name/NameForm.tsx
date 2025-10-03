"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { Input, InputError, InputSuccess } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

import { nameFormAction } from "./actions";

type NameFormState = {
  status: "idle" | "error" | "success";
  name: string;
};

const initialState: NameFormState = {
  status: "idle",
  name: "",
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
          id="name"
          name="name"
          type="text"
          required
          defaultValue={currentName}
          disabled={isPending}
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
