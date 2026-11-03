"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { DoneMark } from "../_components/status-mark";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionHeader,
  SuggestionLine,
  SuggestionLinkAction,
  SuggestionSaveError,
  SuggestionSummary,
} from "../_components/suggestion";
import { SlotContent } from "../plan/plan-suggestion-context";

/** A finished course's certificate: its page once written, else the claim that writes it. */
export type CourseCertificate = { href: string | null; onClaim: () => Promise<boolean> };

function useCertificateClaim(onClaim: CourseCertificate["onClaim"]) {
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const claim = () => {
    startTransition(async () => {
      const { data: claimed } = await safeAsync(onClaim);
      setFailed(!claimed);
    });
  };

  return { claim, failed, isPending };
}

function ClaimAction({
  claim,
  isPending,
  variant,
}: {
  claim: () => void;
  isPending: boolean;
  variant: "default" | "outline";
}) {
  const t = useExtracted();

  return (
    <SuggestionAction
      aria-busy={isPending || undefined}
      disabled={isPending}
      onClick={claim}
      variant={variant}
    >
      {t("Get your certificate")}
    </SuggestionAction>
  );
}

export function CertificateAction({
  certificate,
  primary,
}: {
  certificate: CourseCertificate;
  primary: boolean;
}) {
  const t = useExtracted();
  const { claim, failed, isPending } = useCertificateClaim(certificate.onClaim);
  const variant = primary ? "default" : "outline";

  if (certificate.href) {
    return (
      <SuggestionLinkAction href={certificate.href} variant={variant}>
        {t("View certificate")}
      </SuggestionLinkAction>
    );
  }

  return (
    <>
      <ClaimAction claim={claim} isPending={isPending} variant={variant} />
      {failed && <SuggestionSaveError />}
    </>
  );
}

/** An exam's course can finish before its exam-day mocks, so its certificate comes before the plan's end. */
export function CourseCompleteSuggestion({ onClaim }: Pick<CourseCertificate, "onClaim">) {
  const t = useExtracted();
  const { claim, failed, isPending } = useCertificateClaim(onClaim);

  const title = t({
    description:
      "A Plan suggestion's title once every lesson and challenge of the course is done, while the exam's practice tests are still ahead",
    message: "Course complete",
  });

  return (
    <Suggestion label={title} mark={<DoneMark />}>
      <SuggestionLine>
        {failed ? (
          <SuggestionSaveError className="min-w-0 flex-1" />
        ) : (
          <SuggestionSummary>{title}</SuggestionSummary>
        )}
        <ClaimAction claim={claim} isPending={isPending} variant="outline" />
      </SuggestionLine>

      <SlotContent>
        <SuggestionHeader>{title}</SuggestionHeader>
        <SuggestionActions>
          <ClaimAction claim={claim} isPending={isPending} variant="default" />
        </SuggestionActions>
        {failed && <SuggestionSaveError />}
      </SlotContent>
    </Suggestion>
  );
}
