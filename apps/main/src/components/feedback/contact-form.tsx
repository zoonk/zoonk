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
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Textarea } from "@zoonk/ui/components/textarea";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { useExtracted } from "next-intl";
import { useActionState, useId } from "react";
import { type ContactFormState, contactFormAction } from "./contact-form-action";

const initialState: ContactFormState = { status: "idle" };

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

/**
 * Preserves the contact form's layout while the signed-in learner's email is loading.
 */
export function ContactFormSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-5 w-56 max-w-full" />
      </div>

      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-5 w-64 max-w-full" />
      </div>

      <Skeleton className="h-9 w-32" />
    </div>
  );
}
