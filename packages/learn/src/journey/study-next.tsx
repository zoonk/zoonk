"use client";

import { type StudyNextView } from "@zoonk/core/view-models/map/contract";
import { LibraryIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  ListGroup,
  ListRowContent,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { DoneMark } from "../_components/status-mark";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionLinkAction,
  SuggestionOpen,
  SuggestionSaveError,
  SuggestionSummary,
} from "../_components/suggestion";
import { useLevelName } from "../course/use-level-name";
import { SlotContent } from "../plan/plan-suggestion-context";

type CourseLink = StudyNextView["related"][number];

/** A finished course's certificate: its page once written, else the claim that writes it. */
type StudyNextCertificate = { href: string | null; onClaim: () => Promise<boolean> };

export type StudyNext = {
  certificate: StudyNextCertificate | null;
  onContinue: () => Promise<boolean>;
  view: StudyNextView;
};

function CertificateAction({
  certificate,
  primary,
}: {
  certificate: StudyNextCertificate;
  primary: boolean;
}) {
  const t = useExtracted();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const variant = primary ? "default" : "outline";

  if (certificate.href) {
    return (
      <SuggestionLinkAction href={certificate.href} variant={variant}>
        {t("View certificate")}
      </SuggestionLinkAction>
    );
  }

  const claim = () => {
    startTransition(async () => {
      setFailed(!(await certificate.onClaim()));
    });
  };

  return (
    <>
      <SuggestionAction
        aria-busy={isPending || undefined}
        disabled={isPending}
        onClick={claim}
        variant={variant}
      >
        {t("Get your certificate")}
      </SuggestionAction>
      {failed && <SuggestionSaveError />}
    </>
  );
}

function ContinueAtNextLevel({
  next,
  onContinue,
}: {
  next: NonNullable<StudyNextView["nextLevel"]>;
  onContinue: () => Promise<boolean>;
}) {
  const t = useExtracted();
  const levelName = useLevelName();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const start = () => {
    startTransition(async () => {
      setFailed(!(await onContinue()));
    });
  };

  return (
    <>
      <SuggestionAction disabled={isPending} onClick={start}>
        {t("Continue at {level}", { level: levelName(next.level) })}
      </SuggestionAction>
      {failed && <SuggestionSaveError />}
    </>
  );
}

function RelatedCourses({
  courseHref,
  related,
}: {
  courseHref: (course: CourseLink) => string;
  related: CourseLink[];
}) {
  const t = useExtracted();

  if (related.length === 0) {
    return null;
  }

  return (
    <nav aria-label={t("Related courses")}>
      <ListGroup>
        {related.map((course) => (
          <ListRowLink href={courseHref(course)} key={course.courseId}>
            <ListRowLeading>
              <ListRowIcon>
                <LibraryIcon />
              </ListRowIcon>
            </ListRowLeading>
            <ListRowContent>
              <ListRowTitle>{course.title}</ListRowTitle>
            </ListRowContent>
          </ListRowLink>
        ))}
      </ListGroup>
    </nav>
  );
}

export function StudyNextSuggestion({
  courseHref,
  next: { certificate, onContinue, view: next },
}: {
  courseHref: (course: CourseLink) => string;
  next: StudyNext;
}) {
  const t = useExtracted();
  const hasNext = next.nextLevel !== null || next.related.length > 0;
  const title = t("You finished your plan");

  return (
    <Suggestion label={title} mark={<DoneMark />}>
      <SuggestionLine>
        <SuggestionSummary>{title}</SuggestionSummary>
        <SuggestionOpen />
      </SuggestionLine>

      <SlotContent>
        <SuggestionHeader>{title}</SuggestionHeader>
        {hasNext && (
          <SuggestionDescription>{t("Here's what to study next.")}</SuggestionDescription>
        )}

        {(next.nextLevel || certificate) && (
          <SuggestionActions>
            {certificate && (
              <CertificateAction certificate={certificate} primary={!next.nextLevel} />
            )}
            {next.nextLevel && (
              <ContinueAtNextLevel next={next.nextLevel} onContinue={onContinue} />
            )}
          </SuggestionActions>
        )}

        <RelatedCourses courseHref={courseHref} related={next.related} />
      </SlotContent>
    </Suggestion>
  );
}
