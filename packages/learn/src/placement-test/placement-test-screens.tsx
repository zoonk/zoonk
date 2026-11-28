"use client";

import { MeterParts } from "@zoonk/ui/components/meter";
import { useExtracted } from "next-intl";
import { Eyebrow } from "../_components/eyebrow";
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
import { Surface } from "../_components/surface";
import { TaskMeta } from "../_components/task-meta";
import { useFormatDuration } from "../_utils/time-format";
import { OnboardingDescription } from "../onboarding/onboarding-frame";
import { TestOutcome } from "../onboarding/test-outcome";
import { useSkippedLessonsSentences } from "../plan/use-skipped-lessons-sentences";
import { type ResultUndo, useResultUndo } from "../questions/undo-button";
import { DaySegment } from "../today/day-segments";
import { type PlacementResultPhase } from "./placement-test-phase";
import { type TestPressed } from "./test-offer";

type Course = NonNullable<PlacementResultPhase["course"]>;
type Chapter = Course["chapters"][number];

function toChapterState(chapter: Chapter) {
  if (chapter.start) {
    return "current";
  }

  return chapter.lessons > 0 && chapter.skipped >= chapter.lessons ? "done" : "ahead";
}

function CourseLine({ course }: { course: Course }) {
  return (
    <MeterParts data-slot="course-line">
      {course.chapters.map((chapter, index) => {
        const state = toChapterState(chapter);

        return (
          <DaySegment
            // oxlint-disable-next-line react/no-array-index-key -- Chapters are positions in the plan.
            key={index}
            share={
              state === "done" || chapter.lessons === 0 ? 0 : chapter.skipped / chapter.lessons
            }
            state={state}
            weight={chapter.lessons}
          />
        );
      })}
    </MeterParts>
  );
}

function useCourseFact() {
  const t = useExtracted();

  return ({ lessons, skipped }: { lessons: number; skipped: number }): string =>
    skipped > 0
      ? t({
          description:
            "Under a picture of a course, after a placement test: how many of the course's lessons the test skipped, out of all of them.",
          message:
            "{skipped, plural, one {# of {lessons, number} lessons skipped} other {# of {lessons, number} lessons skipped}}",
          values: { lessons, skipped },
        })
      : t("{count, plural, one {# lesson} other {# lessons}}", { count: lessons });
}

export function UpNextLesson({ title }: { title: string }) {
  const t = useExtracted();

  return (
    <Surface className="flex flex-col gap-1 p-4">
      <Eyebrow className="self-start">{t("Up next")}</Eyebrow>
      <p className="font-medium [text-box:trim-end_cap_alphabetic]">{title}</p>
    </Surface>
  );
}

function StartLesson({ lesson }: { lesson: NonNullable<PlacementResultPhase["nextLesson"]> }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (
    <ListGroup>
      <ListRow data-highlighted="">
        <ListRowLeading>
          <StatusMark status="next" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{lesson.title}</ListRowTitle>
          <ListRowDescription>{t("Up next")}</ListRowDescription>
        </ListRowContent>
        <ListRowTrailing>{formatDuration(lesson.estimatedMinutes)}</ListRowTrailing>
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

export function PlacementResult({
  failed,
  onDone,
  onStartLesson,
  onboarding,
  pending,
  pressed,
  result,
  undo,
}: {
  failed: boolean;
  onDone: () => void;
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
  const courseFact = useCourseFact();
  const { button, pending: undoing, undone } = useResultUndo(undo);
  const { chapter, course, lessonsSkipped } = result;
  const nextLesson = undone ? null : result.nextLesson;
  const action = useResultAction({ nextLesson: result.saved ? null : nextLesson, onboarding });
  const { lessonId } = action;
  // Undone, the start is back at the course's first lesson, which this result doesn't name.
  const place = undone ? null : chapter;

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
          <TaskMeta facts={[courseFact({ lessons: course.lessons, skipped: lessonsSkipped })]} />
        </div>
      )}

      {course && nextLesson && <StartLesson lesson={nextLesson} />}
    </TestOutcome>
  );
}
