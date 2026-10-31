"use client";

import {
  type BirthYearOutcome,
  askLearnerOnce,
  cancelBirthYear,
  getBirthYearRequest,
  getServerBirthYearRequest,
  submitBirthYear,
  subscribeToBirthYearRequest,
} from "@/lib/age/birth-year-request";
import { forgetDeletedSession } from "@/lib/forget-deleted-session";
import { readLearnerSummary } from "@/lib/learner/learner-summary-core";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { logout } from "@/lib/logout";
import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Spinner } from "@zoonk/ui/components/spinner";
import { isValidBirthYear } from "@zoonk/utils/age";
import { parseFormField } from "@zoonk/utils/form";
import { useExtracted } from "next-intl";
import { useActionState, useEffect, useId, useState, useSyncExternalStore } from "react";

const FOUR_DIGITS = /^\d{4}$/u;

type FormError = "failed" | "invalid";

function BirthYearError({ error, id }: { error: FormError; id: string }) {
  const t = useExtracted();

  return (
    <FieldError id={id}>
      {error === "invalid"
        ? t("Check the year and try again.")
        : t("We couldn't save it. Check your connection and try again.")}
    </FieldError>
  );
}

/** No year is filled in for them, so the answer is theirs, as a neutral age screen needs. */
function BirthYearForm({
  signedIn,
  submit,
}: {
  signedIn: boolean;
  submit: (birthYear: number) => Promise<BirthYearOutcome>;
}) {
  const t = useExtracted();
  const inputId = useId();
  const errorId = useId();
  const [year, setYear] = useState("");

  const [error, formAction, pending] = useActionState<FormError | null, FormData>(
    async (_error, formData) => {
      const birthYear = Number(parseFormField(formData, "birthYear"));

      if (!isValidBirthYear({ birthYear, now: new Date() })) {
        return "invalid";
      }

      const outcome = await submitBirthYear({ birthYear, signedIn, submit });
      return outcome.status === "failed" || outcome.status === "invalid" ? outcome.status : null;
    },
    null,
  );

  return (
    <form action={formAction} className="grid gap-6">
      <DialogHeader>
        <DialogTitle>{t("What year were you born?")}</DialogTitle>
        <DialogDescription>{t("We ask everyone once.")}</DialogDescription>
      </DialogHeader>

      <Field data-invalid={error === "invalid"}>
        <FieldLabel className="sr-only" htmlFor={inputId}>
          {t("Birth year")}
        </FieldLabel>
        <Input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error === "invalid"}
          autoComplete="bday-year"
          className="font-mono tabular-nums"
          id={inputId}
          inputMode="numeric"
          maxLength={4}
          name="birthYear"
          onChange={(event) => setYear(event.target.value.replaceAll(/\D/gu, ""))}
          value={year}
        />
        {error && <BirthYearError error={error} id={errorId} />}
      </Field>

      <div className="grid gap-2">
        <Button disabled={!FOUR_DIGITS.test(year) || pending} size="lg" type="submit">
          {t("Continue")}
          {pending ? (
            <Spinner aria-hidden="true" data-icon="inline-end" />
          ) : (
            <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
          )}
        </Button>

        {!signedIn && (
          <Button
            disabled={pending}
            onClick={cancelBirthYear}
            size="lg"
            type="button"
            variant="ghost"
          >
            {t("Not now")}
          </Button>
        )}
      </div>
    </form>
  );
}

function AgeStopMessage({
  accountClosed,
  minimumAge,
  signedIn,
}: {
  accountClosed: boolean;
  minimumAge: number;
  signedIn: boolean;
}) {
  const t = useExtracted();

  if (accountClosed) {
    return t(
      "You need to be {minimumAge, number} or older to use Zoonk, so we've closed your account and deleted its data. We'll be here when you are.",
      { minimumAge },
    );
  }

  return signedIn
    ? t(
        "You need to be {minimumAge, number} or older to use Zoonk, so we'll log you out. We'll be here when you are.",
        { minimumAge },
      )
    : t("You need to be {minimumAge, number} or older to use Zoonk. We'll be here when you are.", {
        minimumAge,
      });
}

/** A closed account's cookies go too: its session no longer exists. */
function leaveAgeStop({ accountClosed, signedIn }: { accountClosed: boolean; signedIn: boolean }) {
  if (accountClosed) {
    void forgetDeletedSession().then(() => globalThis.location.assign("/"));
  } else if (signedIn) {
    void logout();
  } else {
    cancelBirthYear();
  }
}

/** A visitor stays where they were; an account is logged out, or closed, since it can't go on. */
function AgeStop({
  accountClosed,
  minimumAge,
  signedIn,
}: {
  accountClosed: boolean;
  minimumAge: number;
  signedIn: boolean;
}) {
  const t = useExtracted();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("Not just yet")}</DialogTitle>
        <DialogDescription className="text-pretty">
          <AgeStopMessage
            accountClosed={accountClosed}
            minimumAge={minimumAge}
            signedIn={signedIn}
          />
        </DialogDescription>
      </DialogHeader>

      <Button autoFocus onClick={() => leaveAgeStop({ accountClosed, signedIn })} size="lg">
        {t("OK")}
      </Button>
    </>
  );
}

/**
 * Asks a new guest before their account exists (`ensureGuestSession`), and any account without a
 * birth year when it opens the app. Only a visitor can close it; an account answers to go on.
 */
export function BirthYearGate() {
  const learner = useLearnerSummary();
  const needsBirthYear = learner.status === "ready" && learner.summary.needsBirthYear;

  const request = useSyncExternalStore(
    subscribeToBirthYearRequest,
    getBirthYearRequest,
    getServerBirthYearRequest,
  );

  useEffect(() => {
    if (needsBirthYear) {
      void askLearnerOnce()?.then(() => readLearnerSummary());
    }
  }, [needsBirthYear]);

  return (
    <Dialog
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open) {
          cancelBirthYear();
        }
      }}
      open={request.status !== "closed"}
    >
      <DialogContent>
        {request.status === "asking" && (
          <BirthYearForm signedIn={request.signedIn} submit={request.submit} />
        )}
        {request.status === "stopped" && (
          <AgeStop
            accountClosed={request.accountClosed}
            minimumAge={request.minimumAge}
            signedIn={request.signedIn}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
