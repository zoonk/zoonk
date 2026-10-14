"use client";

import {
  OTPActions,
  OTPError,
  OTPForm as OTPFormContainer,
  OTPInput,
  OTPLinks,
  OTPSubmit,
  OTP_LINK_CLASS,
} from "@/components/otp";
import { authClient } from "@zoonk/auth/client";
import { DISPOSABLE_EMAIL_ERROR_CODE } from "@zoonk/auth/email-signup-contract";
import { Button } from "@zoonk/ui/components/button";
import { parseFormField } from "@zoonk/utils/form";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { getCallbackHref } from "../_utils/auth-redirect";
import { ChangeEmailLink } from "./change-email-link";

const TOO_MANY_REQUESTS = 429;

/**
 * What the last try said. A code that expired or had too many wrong tries is gone for good (auth
 * deletes it), so those two wait for a new code instead of letting another try fail as "wrong".
 */
type OTPStatus =
  | "idle"
  | "pending"
  | "wrongCode"
  | "expired"
  | "tooManyAttempts"
  | "rateLimited"
  | "disposableEmail"
  | "error";

type ResendStatus = "idle" | "sending" | "sent" | "rateLimited" | "failed";

function getErrorStatus(error: { code?: string; status: number }): OTPStatus {
  if (error.code === DISPOSABLE_EMAIL_ERROR_CODE) {
    return "disposableEmail";
  }

  if (error.code === "TOO_MANY_ATTEMPTS") {
    return "tooManyAttempts";
  }

  if (error.code === "OTP_EXPIRED") {
    return "expired";
  }

  if (error.status === TOO_MANY_REQUESTS) {
    return "rateLimited";
  }

  return error.code === "INVALID_OTP" ? "wrongCode" : "error";
}

function needsNewCode(status: OTPStatus): boolean {
  return status === "expired" || status === "tooManyAttempts";
}

function OTPErrorMessage({ status }: { status: OTPStatus }) {
  const t = useExtracted();

  const messages: Partial<Record<OTPStatus, string>> = {
    disposableEmail: t(
      "Temporary email addresses aren't supported. Use another email or a privacy alias.",
    ),
    error: t("Something went wrong. Try again in a moment."),
    expired: t("This code expired. Get a new one."),
    rateLimited: t("Too many tries. Wait a minute, then try again."),
    tooManyAttempts: t("Too many wrong tries with this code. Get a new one."),
    wrongCode: t("That code isn't right. Check the email and try again."),
  };

  const message = messages[status];

  return (
    <OTPError aria-live="polite" hasError={Boolean(message)}>
      {message}
    </OTPError>
  );
}

function ResendMessage({ email, status }: { email: string; status: ResendStatus }) {
  const t = useExtracted();

  if (status === "sent") {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("We sent a new code to {email}.", { email })}
      </p>
    );
  }

  if (status === "rateLimited" || status === "failed") {
    return (
      <p className="text-destructive-text text-sm" role="alert">
        {status === "rateLimited"
          ? t("Wait a minute before asking for another code.")
          : t("We couldn't send a new code. Try again.")}
      </p>
    );
  }

  return null;
}

/** Sends the same email a fresh code; the old one stops working. */
function useResendCode(email: string) {
  const [status, setStatus] = useState<ResendStatus>("idle");

  const resend = async (): Promise<boolean> => {
    setStatus("sending");

    const { data, error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });

    if (error) {
      setStatus(error.status === TOO_MANY_REQUESTS ? "rateLimited" : "failed");
      return false;
    }

    const isSent = data.success;
    setStatus(isSent ? "sent" : "failed");
    return isSent;
  };

  return { resend, status };
}

export function OTPForm({ email, redirectTo }: { email: string; redirectTo: string | null }) {
  const t = useExtracted();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<OTPStatus>("idle");
  const [codeRound, setCodeRound] = useState(0);
  const resendCode = useResendCode(email);
  const isCodeGone = needsNewCode(status);
  const isChecking = status === "pending";

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isCodeGone || isChecking) {
      return;
    }

    setStatus("pending");

    const otp = parseFormField(new FormData(event.currentTarget), "otp");

    if (!otp) {
      setStatus("wrongCode");
      return;
    }

    const { error } = await authClient.signIn.emailOtp({ email, otp });

    if (error) {
      setStatus(getErrorStatus(error));
      return;
    }

    // A full load, not a client navigation: the router may still hold the callback as it rendered
    // before sign-in (no session), which sent the learner back to the email form on the first try.
    globalThis.location.assign(getCallbackHref(redirectTo));
  };

  /** A new code starts a clean try: an empty input and no old error. */
  const sendNewCode = async () => {
    if (await resendCode.resend()) {
      setStatus("idle");
      setCodeRound((round) => round + 1);
    }
  };

  return (
    <OTPFormContainer onSubmit={handleSubmit} ref={formRef}>
      {/* Focused on arrival (and after a new code), so the code can be typed or pasted right away.
          The sixth digit sends it; Continue stays for the keyboard and for a try after an error. */}
      <OTPInput
        aria-label={t("Code from the email")}
        autoFocus
        disabled={isCodeGone}
        key={codeRound}
        onComplete={() => formRef.current?.requestSubmit()}
      />
      <OTPErrorMessage status={status} />
      <ResendMessage email={email} status={resendCode.status} />

      <OTPActions>
        {isCodeGone ? (
          <Button
            className="w-full font-[560]"
            disabled={resendCode.status === "sending"}
            onClick={sendNewCode}
            size="lg"
            type="button"
          >
            {t("Send a new code")}
          </Button>
        ) : (
          <OTPSubmit isLoading={isChecking}>{t("Continue")}</OTPSubmit>
        )}
      </OTPActions>

      <OTPLinks>
        {!isCodeGone && (
          <>
            {t("Didn't get it?")}
            <button
              className={OTP_LINK_CLASS}
              disabled={resendCode.status === "sending"}
              onClick={sendNewCode}
              type="button"
            >
              {t("Send again")}
            </button>
            <span aria-hidden="true">{" · "}</span>
          </>
        )}

        <ChangeEmailLink redirectTo={redirectTo}>{t("Change email")}</ChangeEmailLink>
      </OTPLinks>
    </OTPFormContainer>
  );
}
