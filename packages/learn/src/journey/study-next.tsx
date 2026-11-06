"use client";

import { type StudyNextView } from "@zoonk/core/view-models/map/contract";
import { safeAsync } from "@zoonk/utils/error";
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
  SuggestionOpen,
  SuggestionSaveError,
  SuggestionSummary,
} from "../_components/suggestion";
import { useLevelName } from "../course/use-level-name";
import { SlotContent } from "../plan/plan-suggestion-context";
import { CertificateAction, type PlanCertificates } from "./course-certificate";

type CourseLink = StudyNextView["related"][number];

export type StudyNext = { onContinue: () => Promise<boolean>; view: StudyNextView };

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
      const { data: started } = await safeAsync(onContinue);
      setFailed(!started);
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
  certificates,
  courseHref,
  next: { onContinue, view: next },
}: {
  certificates: PlanCertificates | null;
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

        {(next.nextLevel || certificates) && (
          <SuggestionActions>
            {certificates && (
              <CertificateAction certificates={certificates} primary={!next.nextLevel} />
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
