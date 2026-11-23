"use client";

import { type StudyNextView } from "@zoonk/core/view-models/map/contract";
import { safeAsync } from "@zoonk/utils/error";
import { CircleAlertIcon, LibraryIcon, PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
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
import { useSharedRequest, useSharedState } from "../plan/layout-shared";
import { SlotContent } from "../plan/plan-suggestion-context";
import {
  CertificateAction,
  type PlanCertificates,
  useCertificateClaimFailed,
} from "./course-certificate";

type CourseLink = StudyNextView["related"][number];

export type StudyNext = { onContinue: () => Promise<boolean>; view: StudyNextView };

const CONTINUE_FAILED = "continueFailed";

function ContinueAtNextLevel({
  next,
  onContinue,
}: {
  next: NonNullable<StudyNextView["nextLevel"]>;
  onContinue: () => Promise<boolean>;
}) {
  const t = useExtracted();
  const levelName = useLevelName();
  const [, setFailed] = useSharedState(CONTINUE_FAILED, false);
  const [ownPending, startTransition] = useTransition();
  const request = useSharedRequest("continue", ownPending);
  const isPending = request.busy;

  const start = () => {
    startTransition(async () => {
      request.start();
      const { data: started } = await safeAsync(onContinue);
      setFailed(!started);
    });
  };

  return (
    <SuggestionAction action={start} busy={isPending} icon={<PlayIcon aria-hidden="true" />}>
      {t("Continue at {level}", { level: levelName(next.level) })}
    </SuggestionAction>
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
  const title = t("You finished your plan");
  const claimFailed = useCertificateClaimFailed();
  const [continueFailed] = useSharedState(CONTINUE_FAILED, false);
  const more = Boolean(next.nextLevel) || next.related.length > 0;

  return (
    <Suggestion label={title} mark={claimFailed ? <CircleAlertIcon /> : <DoneMark />}>
      <SuggestionLine>
        {claimFailed ? (
          <SuggestionSaveError className="min-w-0 flex-1" />
        ) : (
          <SuggestionSummary>{title}</SuggestionSummary>
        )}
        {certificates ? (
          <CertificateAction certificates={certificates} primary={false} />
        ) : (
          <SuggestionOpen />
        )}
        {certificates && more && <SuggestionOpen />}
      </SuggestionLine>

      <SlotContent>
        <SuggestionHeader>{title}</SuggestionHeader>
        {more && (
          <SuggestionDescription>
            {t({
              description: "Leads to what to study next",
              message: "Here's what to study next.",
            })}
          </SuggestionDescription>
        )}
        {(next.nextLevel || certificates) && (
          <SuggestionActions
            main={
              next.nextLevel ? (
                <ContinueAtNextLevel next={next.nextLevel} onContinue={onContinue} />
              ) : (
                certificates && <CertificateAction certificates={certificates} primary />
              )
            }
          >
            {next.nextLevel && certificates && (
              <CertificateAction certificates={certificates} primary={false} />
            )}
          </SuggestionActions>
        )}
        {(claimFailed || continueFailed) && <SuggestionSaveError />}

        <RelatedCourses courseHref={courseHref} related={next.related} />
      </SlotContent>
    </Suggestion>
  );
}
