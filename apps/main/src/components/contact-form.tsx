"use client";

import { Input, InputError, InputSuccess } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { authClient } from "@/lib/auth/client";
import { contactFormAction } from "./contact-form-action";

type ContactFormState = {
  status: "idle" | "error" | "success";
};

const initialState: ContactFormState = {
  status: "idle",
};

export function ContactForm() {
  const { data: session, isPending } = authClient.useSession();
  const t = useTranslations("Contact");
  const emailId = useId();
  const messageId = useId();

  const [state, formAction, _pending] = useActionState(
    contactFormAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>{t("email")}</Label>
        <Input
          autoComplete="email"
          defaultValue={session?.user?.email ?? ""}
          disabled={isPending}
          id={emailId}
          name="email"
          placeholder={t("emailPlaceholder")}
          required
          type="email"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={messageId}>{t("message")}</Label>
        <textarea
          className="min-h-32 resize-y rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          id={messageId}
          name="message"
          placeholder={t("messagePlaceholder")}
          required
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
