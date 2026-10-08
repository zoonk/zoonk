"use client";

import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { HeartHandshakeIcon, ShieldCheckIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useId, useState } from "react";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { StepForm } from "./step-form";
import { StepIcon } from "./step-parts";

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const OLDEST_AGE = 100;
/** Any year works for naming months. */
const ANY_YEAR = 2000;
/** The wrapper takes the column; the select inside gets the size. */
const SELECT_CLASS = "w-full [&_select]:h-12 [&_select]:text-base";

function useYears(): number[] {
  const thisYear = new Date().getFullYear();
  return Array.from({ length: OLDEST_AGE }, (_, index) => thisYear - index);
}

/**
 * Birth month and year: the least that tells who is under 13, 16 or 18. Under 13 can't use
 * Zoonk; under 18 gets the most private settings. Saying nothing is allowed and gets them too.
 */
export function AgeStep({
  onAnswer,
  pending,
}: {
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const monthId = useId();
  const yearId = useId();
  const years = useYears();
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  return (
    <StepForm
      canContinue={Boolean(month && year)}
      description={t("We ask so we can keep younger learners safe. Nobody else sees it.")}
      onContinue={() =>
        onAnswer({ birth: { month: Number(month), year: Number(year) }, question: "age" })
      }
      onSkip={() => onAnswer({ birth: null, question: "age" })}
      pending={pending}
      skipLabel={t("Prefer not to say")}
      title={t("When were you born?")}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={monthId}>{t("Month")}</Label>
          <NativeSelect
            className={SELECT_CLASS}
            id={monthId}
            onChange={(event) => setMonth(event.target.value)}
            value={month}
          >
            <NativeSelectOption disabled value="">
              {t("Month")}
            </NativeSelectOption>
            {MONTHS.map((item) => (
              <NativeSelectOption key={item} value={String(item)}>
                {format.dateTime(new Date(Date.UTC(ANY_YEAR, item - 1, 1)), {
                  month: "long",
                  timeZone: "UTC",
                })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={yearId}>{t("Year")}</Label>
          <NativeSelect
            className={SELECT_CLASS}
            id={yearId}
            onChange={(event) => setYear(event.target.value)}
            value={year}
          >
            <NativeSelectOption disabled value="">
              {t("Year")}
            </NativeSelectOption>
            {years.map((item) => (
              <NativeSelectOption key={item} value={String(item)}>
                {String(item)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
    </StepForm>
  );
}

/**
 * Teens get the most private settings, and can invite a parent or guardian to see their weekly
 * activity, set a daily time limit, turn memory off and approve Plus. Inviting is optional.
 */
export function GuardianInviteStep({
  onDone,
  onInvite,
}: {
  onDone: () => void;
  onInvite: (email: string) => Promise<boolean>;
}) {
  const t = useExtracted();
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"failed" | "idle" | "sending" | "sent">("idle");

  const invite = async () => {
    setStatus("sending");
    setStatus((await onInvite(email.trim())) ? "sent" : "failed");
  };

  return (
    <StepForm
      canContinue={status === "sent" || email.includes("@")}
      continueLabel={status === "sent" ? t("Continue") : t("Send invite")}
      description={t(
        "Because you're under 18, we keep things private: no marketing email, no stored audio, and memory stays off unless you turn it on.",
      )}
      onContinue={() => (status === "sent" ? onDone() : invite())}
      onSkip={status === "sent" ? undefined : onDone}
      pending={status === "sending"}
      skipLabel={t("Not now")}
      title={t("Invite a parent or guardian")}
    >
      <div className="flex items-start gap-3 text-sm">
        <ShieldCheckIcon aria-hidden="true" className="text-success mt-0.5 size-5 shrink-0" />
        <p>
          {t(
            "They'll see your weekly activity and can set a daily time limit, turn memory off and approve Plus. Never your answers.",
          )}
        </p>
      </div>

      {status === "sent" ? (
        <p className="text-success font-medium" role="status">
          {t("Invite sent. You can keep going.")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor={emailId}>{t("Their email")}</Label>
          <Input
            autoComplete="off"
            className="h-12 text-base"
            id={emailId}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
          {status === "failed" && (
            <p className="text-destructive text-sm" role="alert">
              {t("We couldn't send the invite. Check the email and try again.")}
            </p>
          )}
        </div>
      )}
    </StepForm>
  );
}

/** Under 13: a kind goodbye. Nothing they entered was kept. */
export function TooYoung() {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <StepIcon>
        <HeartHandshakeIcon />
      </StepIcon>
      <OnboardingHeading>
        <OnboardingTitle>{t("Zoonk is for learners 13 and older")}</OnboardingTitle>
        <OnboardingDescription>
          {t(
            "We didn't keep anything you entered. Ask a parent or a teacher about learning apps made for your age. We'd love to see you here when you're 13!",
          )}
        </OnboardingDescription>
      </OnboardingHeading>
    </OnboardingColumn>
  );
}
