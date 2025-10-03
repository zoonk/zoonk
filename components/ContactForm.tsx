"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { Input, InputError } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

import { contactFormAction } from "./contactFormAction";

type ContactFormState = {
  status: "idle" | "error" | "success";
};

const initialState: ContactFormState = {
  status: "idle",
};

export function ContactForm() {
  const { data: session, isPending } = authClient.useSession();
  const t = useTranslations("Contact");

  const [state, formAction, _pending] = useActionState(
    contactFormAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-4 flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder={t("emailPlaceholder")}
          defaultValue={session?.user?.email ?? ""}
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">{t("message")}</Label>
        <textarea
          id="message"
          name="message"
          required
          placeholder={t("messagePlaceholder")}
          className="min-h-32 resize-y rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        />
      </div>

      {state.status === "error" && <InputError>{t("error")}</InputError>}

      {state.status === "success" && (
        <p className="text-green-600 text-sm">{t("success")}</p>
      )}

      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}
