import { getLessonPlayerPath } from "@/lib/public/public-hrefs";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { getPublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { type FirstChoiceScreen, FirstQuestion } from "./first-question";
import { ScrollToAnchor } from "./scroll-to-anchor";

/** A lesson a page could offer to try, with its chapter and its number there for the card's line. */
export type TryLessonCandidate = { chapterTitle: string; lessonId: string; number: number };

/** The lesson a page offers to try: a candidate whose first screen is a question. */
export type TryLessonPick = TryLessonCandidate & { minutes: number; screen: FirstChoiceScreen };

/** How many of a page's first lessons it looks through for a question to try. */
const CANDIDATES = 8;

/**
 * The card's anchor on a course's or a chapter's page (`scopeId`, the course's or the chapter's),
 * unique in the document, since the router may keep a visited page in it beside the open one.
 */
export function getTryLessonId(scopeId: string): string {
  return `try-lesson-${scopeId}`;
}

/**
 * The lesson a course's or a chapter's page offers to try: among its first lessons in order, the
 * first written one that opens with a guess (a question anyone can answer before the lesson), else
 * the first that opens with a question. Null while none of them is written. Its reads are cached
 * per lesson, so the page can look before it decides to show the card.
 */
export async function pickTryLesson(
  candidates: TryLessonCandidate[],
): Promise<TryLessonPick | null> {
  const lessons = await Promise.all(
    candidates.slice(0, CANDIDATES).map(async (candidate) => {
      const lesson = await getPublicLibraryLesson({ lessonId: candidate.lessonId });
      const screen = lesson?.firstScreen;

      return lesson && screen?.kind === "choice"
        ? { ...candidate, minutes: lesson.estimatedMinutes, screen }
        : null;
    }),
  );

  const questions = lessons.filter((item) => item !== null);
  return questions.find((item) => item.screen.guess) ?? questions[0] ?? null;
}

/**
 * "Try a lesson" on a course's or a chapter's page: what it costs (nothing) and takes, where the
 * lesson sits, then its real first question, answerable right here; any answer opens the player
 * with it, the lesson started, no sign-up needed; once they've answered some of it, the way back
 * in instead (`FirstQuestion`), beside the page's own main action. `id` is the card's anchor (`getTryLessonId`),
 * which the course's "Try a lesson" scrolls to, clear of the page's sticky bar; `origin` is the
 * page's own path, which closing the lesson returns to, at this card.
 */
export async function TryLesson({
  className,
  id,
  locale,
  origin,
  pick,
}: {
  className?: string;
  id: string;
  locale: SupportedLocale;
  origin: string;
  pick: TryLessonPick;
}) {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();
  const titleId = `${id}-title`;

  return (
    <section
      aria-labelledby={titleId}
      className={cn(SURFACE_CLASS, "flex scroll-mt-24 flex-col p-5 sm:p-7", className)}
      id={id}
    >
      <ScrollToAnchor id={id} />

      <h2 className="text-label" id={titleId}>
        {t("Try a lesson · free · {time}", { time: minutesText(pick.minutes) })}
      </h2>

      <p className="text-muted-foreground mt-1.5 mb-5 text-[13px] leading-snug text-pretty">
        {t("{chapter} · lesson {number, number}", {
          chapter: pick.chapterTitle,
          number: pick.number,
        })}
      </p>

      <FirstQuestion
        lessonId={pick.lessonId}
        minutes={pick.minutes}
        origin={`${origin}#${id}`}
        playerPath={getLessonPlayerPath({ lessonId: pick.lessonId, locale })}
        questionId={`${id}-question`}
        screen={pick.screen}
        secondary
      />
    </section>
  );
}
