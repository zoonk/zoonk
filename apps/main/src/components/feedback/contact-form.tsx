"use client";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldDynamicDescription,
  FieldError,
  FieldLabel,
} from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { Textarea } from "@zoonk/ui/components/textarea";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { useExtracted } from "next-intl";
import { useActionState, useId } from "react";
import { contactFormAction } from "./contact-form-action";

const initialState: {
  status: "idle" | "error" | "success";
} = {
  status: "idle",
};

export function ContactForm({ defaultEmail }: { defaultEmail?: string }) {
  const t = useExtracted();
  const emailId = useId();
  const messageId = useId();

  const [state, formAction] = useActionState(contactFormAction, initialState);

  const hasError = state.status === "error";

  return (
    <form action={formAction} className="flex w-full flex-col gap-6">
      <Field>
        <FieldContent>
          <FieldLabel htmlFor={emailId}>{t("Email address")}</FieldLabel>
          <Input
            autoComplete="email"
            defaultValue={defaultEmail ?? ""}
            id={emailId}
            name="email"
            placeholder={t("myemail@gmail.com")}
            required
            type="email"
          />
          <FieldDescription>{t("We'll use this email to contact you.")}</FieldDescription>
        </FieldContent>
      </Field>

      <Field>
        <FieldContent>
          <FieldLabel htmlFor={messageId}>{t("Message")}</FieldLabel>
          <Textarea
            id={messageId}
            name="message"
            placeholder={t("How can we help you?")}
            required
          />
          <FieldDynamicDescription
            successMessage={
              state.status === "success"
                ? t("Message sent successfully! We'll get back to you soon.")
                : null
            }
          >
            {t("Please provide as much detail as possible.")}
          </FieldDynamicDescription>

          {hasError && (
            <FieldError>
              {t(
                "Failed to send message. Please try again or email us directly at hello@zoonk.com",
              )}
            </FieldError>
          )}
        </FieldContent>
      </Field>

      <SubmitButton>{t("Send message")}</SubmitButton>
    </form>
  );
}
