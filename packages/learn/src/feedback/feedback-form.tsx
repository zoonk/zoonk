"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import {
  Field,
  FieldContent,
  FieldDynamicDescription,
  FieldError,
  FieldLabel,
} from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Textarea } from "@zoonk/ui/components/textarea";
import { parseFormField } from "@zoonk/utils/form";
import { PaperclipIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useActionState, useEffect, useId, useState } from "react";
import { EnterButton } from "../_components/enter-button";
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

function EmailField({
  onChange,
  required,
  value,
}: {
  onChange: (email: string) => void;
  required: boolean;
  value: string;
}) {
  const t = useExtracted("feedback");
  const emailId = useId();

  return (
    <Field>
      <FieldContent>
        <FieldLabel htmlFor={emailId}>
          {required ? t("Your email, for our reply") : t("Your email, if you'd like a reply")}
        </FieldLabel>
        <Input
          autoComplete="email"
          id={emailId}
          name="email"
          onChange={(event) => onChange(event.target.value)}
          placeholder={t({
            description: "An example email address in an empty field. Adapt it to the language.",
            message: "myemail@gmail.com",
          })}
          required={required}
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

  const sent = await adapters
    .sendMessage({
      context: { ...context, platform: adapters.platform, url: globalThis.location.pathname },
      email: email || undefined,
      message,
    })
    .catch(() => false);

  if (!sent) {
    return "error";
  }

  return "success";
}

type FeedbackFormLayout = "dialog" | "page";

/**
 * The form's main action, in the dialog and on the page alike. Enter presses it from anywhere but
 * the message, which keeps Enter for a new line, as every text area does.
 */
function SendButton({ busy, disabled, form }: { busy: boolean; disabled: boolean; form?: string }) {
  const t = useExtracted("feedback");

  return (
    <EnterButton busy={busy} disabled={disabled} form={form} type="submit">
      {t("Send message")}
    </EnterButton>
  );
}

function ScreenAttached() {
  const t = useExtracted("feedback");

  return (
    <span className="flex items-center gap-2">
      <PaperclipIcon aria-hidden="true" className="size-3.5" />
      {t("This screen is attached")}
    </span>
  );
}

/** On a page, `children` sit between the form and the bar, whose Send belongs to the form alone. */
export function FeedbackForm({
  children,
  context,
  defaultEmail,
  layout = "page",
  onSent,
}: {
  children?: React.ReactNode;
  context: FeedbackFormContext;
  defaultEmail?: string | null;
  layout?: FeedbackFormLayout;
  onSent?: () => void;
}) {
  const t = useExtracted("feedback");
  const feedback = useContentFeedback();
  const messageId = useId();
  const formId = useId();
  const viewerEmail = useViewerEmail({ defaultEmail, feedback });
  const [typedEmail, setTypedEmail] = useState("");
  const email = (viewerEmail ?? typedEmail).trim();
  const isSaveReport = context.reportType === "saveFailure";

  // React clears the form after every send, so a failed one gives the message back as its default.
  const [{ message: unsentMessage, status }, formAction, isPending] = useActionState<
    { message: string; status: FormStatus },
    FormData
  >(
    async (_state, formData) => {
      const message = parseFormField(formData, "message") ?? "";

      if (!feedback || (!isSaveReport && !email) || !message) {
        return { message, status: "error" };
      }

      const result = await sendMessage({ context, email, feedback, message });

      if (result === "success") {
        onSent?.();
        return { message: "", status: result };
      }

      return { message, status: result };
    },
    { message: isSaveReport ? t("I couldn't save my answers.") : "", status: "idle" },
  );

  return (
    <>
      <form action={formAction} className="flex w-full flex-col gap-6" id={formId}>
        <Field>
          <FieldContent>
            <FieldLabel htmlFor={messageId}>{t("Message")}</FieldLabel>
            <Textarea
              className="min-h-32"
              defaultValue={unsentMessage}
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
              {context.contentId && <ScreenAttached />}
            </FieldDynamicDescription>

            {status === "error" && (
              <FieldError>
                {t("We couldn't send your message. Try again, or email us at hello@zoonk.com.")}
              </FieldError>
            )}
          </FieldContent>
        </Field>

        {viewerEmail === null && (
          <EmailField onChange={setTypedEmail} required={!isSaveReport} value={typedEmail} />
        )}

        {layout === "dialog" && (
          <div className="flex sm:justify-end">
            <SendButton busy={isPending} disabled={viewerEmail === undefined} />
          </div>
        )}
      </form>

      {children}

      {layout === "page" && (
        <BottomBar>
          <BottomBarActions>
            <SendButton busy={isPending} disabled={viewerEmail === undefined} form={formId} />
          </BottomBarActions>
        </BottomBar>
      )}
    </>
  );
}

export function FeedbackFormSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <div className="flex w-full flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>

      {children}

      <BottomBar>
        <BottomBarActions>
          <Skeleton className="h-11 w-full rounded-md sm:w-36" />
        </BottomBarActions>
      </BottomBar>
    </>
  );
}
