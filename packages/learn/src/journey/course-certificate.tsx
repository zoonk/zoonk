"use client";

import { type FieldMapView } from "@zoonk/core/view-models/map/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { PlusMark } from "../_components/plus-lock";
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
import { useLevelName } from "../course/use-level-name";
import { SlotContent } from "../plan/plan-suggestion-context";

/**
 * The plan's certificates, from the goal map: `view` opens the one it holds, or Certificates when
 * it holds several; `unclaimed` are finished levels (or the plan) the claim writes.
 */
export type PlanCertificates = {
  onClaim: () => Promise<boolean>;
  unclaimed: NonNullable<FieldMapView["certificates"]>["unclaimed"];
  view: { href: string; locked: boolean; several: boolean } | null;
};

function useCertificateClaim(onClaim: PlanCertificates["onClaim"]) {
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
    <SuggestionAction busy={isPending} onClick={claim} variant={variant}>
      {t("Get your certificate")}
    </SuggestionAction>
  );
}

/** A locked certificate opens its locked page; the mark says Plus unlocks it. */
function ViewAction({
  variant,
  view,
}: {
  variant: "default" | "outline";
  view: NonNullable<PlanCertificates["view"]>;
}) {
  const t = useExtracted();

  return (
    <SuggestionLinkAction href={view.href} variant={variant}>
      {view.several ? t("View certificates") : t("View certificate")}
      {view.locked && (
        <PlusMark
          className={
            variant === "default" ? "bg-primary-foreground/15 text-primary-foreground" : undefined
          }
        />
      )}
    </SuggestionLinkAction>
  );
}

export function CertificateAction({
  certificates,
  primary,
}: {
  certificates: PlanCertificates;
  primary: boolean;
}) {
  const { claim, failed, isPending } = useCertificateClaim(certificates.onClaim);
  const variant = primary ? "default" : "outline";

  if (certificates.unclaimed.length > 0) {
    return (
      <>
        <ClaimAction claim={claim} isPending={isPending} variant={variant} />
        {failed && <SuggestionSaveError />}
      </>
    );
  }

  return certificates.view && <ViewAction variant={variant} view={certificates.view} />;
}

/** "Beginner complete" when the claim would certify one level, else "Course complete". */
function useCompleteTitle(unclaimed: PlanCertificates["unclaimed"]): string {
  const t = useExtracted();
  const levelName = useLevelName();
  const [only] = unclaimed;

  if (unclaimed.length === 1 && only?.courseLevel) {
    return t({
      description:
        "A Plan suggestion's title once every lesson and challenge of a course level is done, such as “Beginner complete”, before the plan's end",
      message: "{level} complete",
      values: { level: levelName(only.courseLevel) },
    });
  }

  return t({
    description:
      "A Plan suggestion's title once every lesson and challenge of the course is done, while the exam's practice tests are still ahead",
    message: "Course complete",
  });
}

/** An exam's course can finish before its exam-day mocks, so its certificate comes before the plan's end. */
export function CourseCompleteSuggestion({
  onClaim,
  unclaimed,
}: Pick<PlanCertificates, "onClaim" | "unclaimed">) {
  const { claim, failed, isPending } = useCertificateClaim(onClaim);
  const title = useCompleteTitle(unclaimed);

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
