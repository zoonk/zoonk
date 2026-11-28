"use client";

import { Button } from "@zoonk/ui/components/button";
import { MeterParts } from "@zoonk/ui/components/meter";
import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { StatusMark } from "../_components/status-mark";
import { TaskMeta } from "../_components/task-meta";
import { useFormatDuration } from "../_utils/time-format";
import { OnboardingDescription } from "../onboarding/onboarding-frame";
import { TestOutcome } from "../onboarding/test-outcome";
import { usePhaseName } from "../plan/use-phase-name";
import { useSkippedLessonsSentences } from "../plan/use-skipped-lessons-sentences";
import { type ResultUndo, useResultUndo } from "../questions/undo-button";
import { DaySegment } from "../today/day-segments";
import { toCourseSegments } from "./course-line";
import { type PlacementResultPhase } from "./placement-test-phase";
import { type TestPressed } from "./test-offer";

type Course = NonNullable<PlacementResultPhase["course"]>;

function CourseLine({ course }: { course: Course }) {
  return (
    <MeterParts data-slot="course-line">
      {toCourseSegments(course.chapters).map((segment, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- Chapters are positions in the plan.
        <DaySegment key={index} {...segment} />
      ))}
    </MeterParts>
  );
}

function useSkippedFact() {
  const t = useExtracted();

  return ({ lessons, skipped }: { lessons: number; skipped: number }): string =>
    t({
      description:
        "Under a picture of a course, after a placement test: how many of the course's lessons the test skipped, out of all of them.",
      message:
        "{skipped, plural, one {# of {lessons, number} lessons skipped} other {# of {lessons, number} lessons skipped}}",
      values: { lessons, skipped },
    });
}

export function UpNextLesson({
  estimatedMinutes,
  title,
}: {
  estimatedMinutes?: number;
  title: string;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (
    <ListGroup>
      <ListRow data-highlighted="">
        <ListRowLeading>
          <StatusMark status="next" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{title}</ListRowTitle>
          <ListRowDescription>{t("Up next")}</ListRowDescription>
        </ListRowContent>
        {estimatedMinutes !== undefined && (
          <ListRowTrailing>{formatDuration(estimatedMinutes)}</ListRowTrailing>
        )}
      </ListRow>
    </ListGroup>
  );
}

/** The main action a result offers on the Plan: the next lesson when it's known, else the way back. */
export function useResultAction({
  nextLesson,
  onboarding,
}: {
  nextLesson: { id: string; title: string } | null | undefined;
  onboarding: boolean;
}): { label: string; lessonId: string | null } {
  const t = useExtracted();

  if (onboarding) {
    return { label: t("Continue"), lessonId: null };
  }

  return nextLesson
    ? { label: t("Start lesson"), lessonId: nextLesson.id }
    : { label: t("Done"), lessonId: null };
}

/** What the result says under its title, only in the two states its picture can't show. */
function ResultLead({
  held,
  lessons,
  undone,
}: {
  held: boolean;
  lessons: number;
  undone: boolean;
}) {
  const t = useExtracted();
  const sentences = useSkippedLessonsSentences();

  if (!undone && !(held && lessons === 0)) {
    return null;
  }

  return (
    <OnboardingDescription role="status">
      {undone
        ? sentences.back(lessons)
        : t("You undid these today. Answer again tomorrow to skip them.")}
    </OnboardingDescription>
  );
}

/** The stop the learner starts in, named as the Plan names it, also when it has no saved name. */
function useStartStopName() {
  const phaseName = usePhaseName();

  return ({ chapter, course }: Pick<PlacementResultPhase, "chapter" | "course">) => {
    const index = course?.chapters.findIndex((stop) => stop.start) ?? -1;

    if (chapter || index === -1) {
      return chapter;
    }

    // A course test runs only on a learn goal, whose stops are all of that kind.
    return phaseName({ index, kind: "learn", name: "", short: null });
  };
}

export function PlacementResult({
  failed,
  onDone,
  onRetake,
  onStartLesson,
  onboarding,
  pending,
  pressed,
  result,
  undo,
}: {
  failed: boolean;
  onDone: () => void;
  /** Opens the offer of a new test, from a past test's result; absent when none can start. */
  onRetake?: () => void;
  onStartLesson: (lessonId: string) => void;
  onboarding: boolean;
  /** The visit is still reading the test, or a save is out: a press now would be dropped. */
  pending: boolean;
  pressed: TestPressed;
  result: PlacementResultPhase;
  undo: ResultUndo;
}) {
  const t = useExtracted();
  const sentences = useSkippedLessonsSentences();
  const skippedFact = useSkippedFact();
  const { button, pending: undoing, undone } = useResultUndo(undo);
  const stopName = useStartStopName();
  const { course, lessonsSkipped } = result;
  const nextLesson = undone ? null : result.nextLesson;
  const action = useResultAction({ nextLesson: result.saved ? null : nextLesson, onboarding });
  const { lessonId } = action;
  // Undone, the start is back at the course's first lesson, which this result doesn't name.
  const place = undone ? null : stopName(result);

  return (
    <TestOutcome
      busy={pressed === "main"}
      continueLabel={action.label}
      disabled={pending || undoing}
      failed={failed}
      lead={<ResultLead held={result.heldUntilTomorrow} lessons={lessonsSkipped} undone={undone} />}
      onContinue={lessonId ? () => onStartLesson(lessonId) : onDone}
      other={button(pending || pressed !== null)}
      subject={
        place
          ? t({
              description:
                "Over the name of the chapter a course's placement test starts the learner in.",
              message: "You start here",
            })
          : undefined
      }
      title={place ?? sentences.skipped(undone ? 0 : lessonsSkipped)}
    >
      {course && !undone && (
        <div className="-mt-1 flex flex-col gap-2.5">
          <CourseLine course={course} />
          {/* With nothing skipped the line and its ring say it; a bare count reads as work done. */}
          {lessonsSkipped > 0 && (
            <TaskMeta facts={[skippedFact({ lessons: course.lessons, skipped: lessonsSkipped })]} />
          )}
        </div>
      )}

      {course && nextLesson && (
        <UpNextLesson estimatedMinutes={nextLesson.estimatedMinutes} title={nextLesson.title} />
      )}

      {onRetake && (
        <Button
          className="self-start"
          disabled={pending || undoing || pressed !== null}
          onClick={onRetake}
          type="button"
          variant="link"
        >
          {t({
            description:
              "A quiet action on the result of a placement test opened again from the plan: it offers a new test.",
            message: "Take the test again",
          })}
        </Button>
      )}
    </TestOutcome>
  );
}
