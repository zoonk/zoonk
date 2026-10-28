"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Field,
  FieldContent,
  FieldDynamicDescription,
  FieldError,
  FieldLabel,
} from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Spinner } from "@zoonk/ui/components/spinner";
import { Textarea } from "@zoonk/ui/components/textarea";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { parseFormField } from "@zoonk/utils/form";
import { PaperclipIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useActionState, useEffect, useId, useState } from "react";
import { type ContentFeedbackContextValue, useContentFeedback } from "./feedback-context";
import { type FeedbackFormContext } from "./feedback-contract";

type FormStatus = "error" | "idle" | "success";

function useViewerEmail({
  defaultEmail,
  feedback,
}: {
  defaultEmail?: string | null;
  feedback: ContentFeedbackContextValue | null;
}): string | null | undefined {
  const [viewerEmail, setViewerEmail] = useState(defaultEmail);

  useEffect(() => {
    if (defaultEmail !== undefined || !feedback) {
      return;
    }

    let isCurrent = true;

    void feedback.adapters.getViewerEmail().then((email) => {
      if (isCurrent) {
        setViewerEmail(email);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [defaultEmail, feedback]);

  return feedback ? viewerEmail : null;
}

function EmailField({ onChange, value }: { onChange: (email: string) => void; value: string }) {
  const t = useExtracted("feedback");
  const emailId = useId();

  return (
    <Field>
      <FieldContent>
        <FieldLabel htmlFor={emailId}>{t("Your email, for our reply")}</FieldLabel>
        <Input
          autoComplete="email"
          id={emailId}
          name="email"
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("myemail@gmail.com")}
          required
          type="email"
          value={value}
        />
      </FieldContent>
    </Field>
  );
}

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

type FeedbackFormLayout = "dialog" | "page";

function SendButton({ disabled, pending }: { disabled: boolean; pending: boolean }) {
  const t = useExtracted("feedback");

  return (
    <Button disabled={disabled || pending} size="sm" type="submit">
      {pending && <Spinner aria-hidden="true" />}
      {t("Send message")}
    </Button>
  );
}

export function FeedbackForm({
  context,
  defaultEmail,
  layout = "page",
}: {
  context: FeedbackFormContext;
  defaultEmail?: string | null;
  layout?: FeedbackFormLayout;
}) {
  const t = useExtracted("feedback");
  const feedback = useContentFeedback();
  const messageId = useId();
  const viewerEmail = useViewerEmail({ defaultEmail, feedback });
  const [typedEmail, setTypedEmail] = useState("");
  const email = (viewerEmail ?? typedEmail).trim();

  const [status, formAction, isPending] = useActionState<FormStatus, FormData>(
    async (_state, formData) => {
      const message = parseFormField(formData, "message") ?? "";

      if (!feedback || !email || !message) {
        return "error";
      }

      return sendMessage({ context, email, feedback, message });
    },
    "idle",
  );

  return (
    <form action={formAction} className="flex w-full flex-col gap-6">
      <Field>
        <FieldContent>
          <FieldLabel htmlFor={messageId}>{t("Message")}</FieldLabel>
          <Textarea
            className="min-h-32"
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
            {context.contentId && (
              <span className="flex items-center gap-2">
                <PaperclipIcon aria-hidden="true" className="size-3.5" />
                {t("This screen is attached")}
              </span>
            )}
          </FieldDynamicDescription>

          {status === "error" && (
            <FieldError>
              {t("We couldn't send your message. Try again, or email us at hello@zoonk.com.")}
            </FieldError>
          )}
        </FieldContent>
      </Field>

      {viewerEmail === null && <EmailField onChange={setTypedEmail} value={typedEmail} />}

      {layout === "page" ? (
        <div className="flex flex-col items-end border-t pt-3">
          <SendButton disabled={viewerEmail === undefined} pending={isPending} />
        </div>
      ) : (
        <SubmitButton disabled={viewerEmail === undefined}>{t("Send message")}</SubmitButton>
      )}
    </form>
  );
}

export function FeedbackFormSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>

      <div className="flex flex-col items-end border-t pt-3">
        <Skeleton className="h-7.5 w-28 rounded-md" />
      </div>
    </div>
  );
}
