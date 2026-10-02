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
import { parseFormField } from "@zoonk/utils/form";
import { PaperclipIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useActionState, useEffect, useId, useState } from "react";
import { FUN_PRIMARY_BUTTON_CLASS } from "../_utils/fun-primary";
import { type ContentFeedbackContextValue, useContentFeedback } from "./feedback-context";
import { type FeedbackFormContext } from "./feedback-contract";

type FormStatus = "error" | "idle" | "success";

/**
 * Fills in the signed-in learner's email once it's known, unless they already typed one. A form
 * rendered with `defaultEmail` (such as the support page, which reads the session) skips the lookup.
 */
function useViewerEmail({
  defaultEmail,
  feedback,
}: {
  defaultEmail?: string | null;
  feedback: ContentFeedbackContextValue | null;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");

  useEffect(() => {
    if (defaultEmail !== undefined || !feedback) {
      return;
    }

    let isCurrent = true;

    void feedback.adapters.getViewerEmail().then((viewerEmail) => {
      if (isCurrent && viewerEmail) {
        setEmail((current) => current || viewerEmail);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [defaultEmail, feedback]);

  return [email, setEmail] as const;
}

/** Sends the message with where it was written, and counts it as a report when it's about content. */
async function sendMessage({
  context,
  email,
  feedback,
  message,
}: {
  context: FeedbackFormContext;
  email: string;
  feedback: ContentFeedbackContextValue;
  message: string;
}): Promise<FormStatus> {
  const { adapters } = feedback;

  const sent = await adapters.sendMessage({
    context: { ...context, platform: adapters.platform, url: globalThis.location.pathname },
    email,
    message,
  });

  if (!sent) {
    return "error";
  }

  adapters.track({
    name: "Feedback Sent",
    properties: { content_kind: context.contentKind ?? null },
  });

  if (context.contentId && context.contentKind) {
    adapters.track({
      name: "Content Reported",
      properties: {
        content_id: context.contentId,
        content_kind: context.contentKind,
        reason: "problem",
      },
    });
  }

  return "success";
}

/**
 * The feedback form: an email to reply to and the message. The page, the content the learner was
 * on, the platform and the app version are attached for them.
 */
export function FeedbackForm({
  context,
  defaultEmail,
}: {
  context: FeedbackFormContext;
  defaultEmail?: string | null;
}) {
  const t = useExtracted("feedback");
  const feedback = useContentFeedback();
  const emailId = useId();
  const messageId = useId();
  const [email, setEmail] = useViewerEmail({ defaultEmail, feedback });

  const [status, formAction] = useActionState<FormStatus, FormData>(async (_state, formData) => {
    const message = parseFormField(formData, "message") ?? "";

    if (!feedback || !email.trim() || !message) {
      return "error";
    }

    return sendMessage({ context, email: email.trim(), feedback, message });
  }, "idle");

  return (
    <form action={formAction} className="flex w-full flex-col gap-6">
      <Field>
        <FieldContent>
          <FieldLabel htmlFor={emailId}>{t("Email address")}</FieldLabel>
          <Input
            autoComplete="email"
            id={emailId}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("myemail@gmail.com")}
            required
            type="email"
            value={email}
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
              status === "success"
                ? t("Message sent successfully! We'll get back to you soon.")
                : null
            }
          >
            {t("Please provide as much detail as possible.")}
          </FieldDynamicDescription>

          {status === "error" && (
            <FieldError>
              {t("We couldn't send your message. Try again, or email us at hello@zoonk.com.")}
            </FieldError>
          )}

          {context.contentId && (
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <PaperclipIcon aria-hidden="true" className="size-3.5" />
              {t("This screen is attached")}
            </p>
          )}
        </FieldContent>
      </Field>

      <SubmitButton className={FUN_PRIMARY_BUTTON_CLASS}>{t("Send message")}</SubmitButton>
    </form>
  );
}

/** Holds the form's place while the signed-in learner's email loads. */
export function FeedbackFormSkeleton() {
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
