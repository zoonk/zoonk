"use client";

import {
  OTPActions,
  OTPError,
  OTPForm as OTPFormContainer,
  OTPInput,
  OTPLinks,
  OTPSubmit,
  OTP_LENGTH,
  OTP_LINK_CLASS,
} from "@/components/otp";
import { authClient } from "@zoonk/auth/client";
import { DISPOSABLE_EMAIL_ERROR_CODE } from "@zoonk/auth/email-signup-contract";
import { Button } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { getCallbackHref } from "../_utils/auth-redirect";
import { ChangeEmailLink } from "./change-email-link";

const TOO_MANY_REQUESTS = 429;

/** Auth deletes a code that expired or had too many wrong tries, so those two wait for a new code. */
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

function canTryAnotherCode(answer: OTPStatus | "signedIn"): boolean {
  return answer === "wrongCode" || answer === "error";
}

async function signInWithCode({
  email,
  otp,
}: {
  email: string;
  otp: string;
}): Promise<OTPStatus | "signedIn"> {
  const { data: result, error } = await safeAsync(() => authClient.signIn.emailOtp({ email, otp }));

  if (error) {
    return "error";
  }

  return result.error ? getErrorStatus(result.error) : "signedIn";
}

async function sendNewSignInCode(email: string): Promise<ResendStatus> {
  const { data: result, error } = await safeAsync(() =>
    authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" }),
  );

  if (error) {
    return "failed";
  }

  if (result.error) {
    return result.error.status === TOO_MANY_REQUESTS ? "rateLimited" : "failed";
  }

  return result.data.success ? "sent" : "failed";
}

function readCode(form: HTMLFormElement): string {
  return parseFormField(new FormData(form), "otp") ?? "";
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

function useResendCode(email: string) {
  const [status, setStatus] = useState<ResendStatus>("idle");

  const resend = async (): Promise<boolean> => {
    setStatus("sending");

    const sendStatus = await sendNewSignInCode(email);
    setStatus(sendStatus);
    return sendStatus === "sent";
  };

  return { resend, status };
}

export function OTPForm({ email, redirectTo }: { email: string; redirectTo: string | null }) {
  const t = useExtracted();
  const formRef = useRef<HTMLFormElement>(null);
  /**
   * A ref, since state lags an answer until it renders: a code finished in between must be neither
   * dropped nor tried against a gone code.
   */
  const isLockedRef = useRef(false);
  const [status, setStatus] = useState<OTPStatus>("idle");
  const [codeRound, setCodeRound] = useState(0);
  const resendCode = useResendCode(email);
  const isCodeGone = needsNewCode(status);
  const isChecking = status === "pending";

  /** Auth turns away a check that overlaps another, so codes are checked one at a time. */
  const checkCode = async ({
    form,
    otp,
  }: {
    form: HTMLFormElement;
    otp: string;
  }): Promise<OTPStatus | "signedIn"> => {
    const answer = await signInWithCode({ email, otp });
    const latestCode = readCode(form);
    const isNewerCode = latestCode.length === OTP_LENGTH && latestCode !== otp;

    if (canTryAnotherCode(answer) && isNewerCode) {
      return checkCode({ form, otp: latestCode });
    }

    return answer;
  };

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLockedRef.current || resendCode.status === "sending") {
      return;
    }

    const form = event.currentTarget;
    const otp = readCode(form);

    if (!otp) {
      setStatus("wrongCode");
      return;
    }

    isLockedRef.current = true;
    setStatus("pending");

    const answer = await checkCode({ form, otp });

    if (answer !== "signedIn") {
      isLockedRef.current = needsNewCode(answer);
      setStatus(answer);
      return;
    }

    // A full load, not a client navigation: the router may still hold the callback as it rendered
    // before sign-in (no session), which sent the learner back to the email form on the first try.
    globalThis.location.assign(getCallbackHref(redirectTo));
  };

  const sendNewCode = async () => {
    if (await resendCode.resend()) {
      isLockedRef.current = false;
      setStatus("idle");
      setCodeRound((round) => round + 1);
    }
  };

  return (
    <OTPFormContainer onSubmit={handleSubmit} ref={formRef}>
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
            {/* Not while a code is checked: its answer would land on the new code's empty box. */}
            <button
              className={OTP_LINK_CLASS}
              disabled={isChecking || resendCode.status === "sending"}
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
