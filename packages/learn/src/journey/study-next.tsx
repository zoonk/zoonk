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
  SuggestionError,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionSummary,
} from "../_components/suggestion";
import { useLevelName } from "../course/use-level-name";
import { SlotContent } from "../plan/plan-suggestion-context";

type CourseLink = StudyNextView["related"][number];

/** "Continue at Beginner": one tap starts the next level; the host opens the new plan. */
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
      {failed && <SuggestionError>{t("That didn't work. Try again in a moment.")}</SuggestionError>}
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

/**
 * Once every lesson of the plan is studied or tested out, the Plan's slot celebrates it and says
 * what to study next: the next level of the same course in one tap, and the other courses the plan
 * drew from, a row each. A plan whose date came with lessons left isn't over (see
 * `PastDateSuggestion`).
 */
export function StudyNextSuggestion({
  courseHref,
  next: { onContinue, view: next },
}: {
  courseHref: (course: CourseLink) => string;
  /** What to study next, and the host's "Continue at the next level". */
  next: { onContinue: () => Promise<boolean>; view: StudyNextView };
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

        {next.nextLevel && (
          <SuggestionActions>
            <ContinueAtNextLevel next={next.nextLevel} onContinue={onContinue} />
          </SuggestionActions>
        )}

        <RelatedCourses courseHref={courseHref} related={next.related} />
      </SlotContent>
    </Suggestion>
  );
}
