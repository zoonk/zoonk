import { type LibraryLessonStartInput } from "@zoonk/core/lesson-player/contract";
import { type DayWork, toDayBlockRef } from "@zoonk/core/sessions/day-block";
import { type DayView } from "@zoonk/core/sessions/day-view";
import { openStudyBlockInputSchema } from "@zoonk/core/sessions/open-block-contract";
import { openStudyDayInputSchema } from "@zoonk/core/sessions/open-day-contract";

type Block = DayWork & { id?: string; opensInPlayer: boolean };
export type LessonOpening = LibraryLessonStartInput["opening"] | "invalid" | null;

export function getStudyLessonHref({
  block,
  goalId,
  session,
}: {
  block: Block;
  goalId: string;
  session: Pick<DayView, "status" | "localDate"> & { id?: string };
}): string | null {
  if (!block.opensInPlayer || !block.lessonId) {
    return null;
  }

  if (session.status !== "unstarted" && session.id && "id" in block) {
    return `/learn/${block.lessonId}?session=${session.id}&block=${block.id}`;
  }

  const query = new URLSearchParams({
    day: session.localDate.toISOString().slice(0, 10),
    goal: goalId,
    ref: JSON.stringify(toDayBlockRef(block)),
  });

  return `/learn/${block.lessonId}?${query}`;
}

export function readLessonOpening(
  query: Record<string, string | string[] | undefined>,
): LessonOpening {
  if (query.block !== undefined) {
    const parsed = openStudyBlockInputSchema.safeParse({
      target: { blockId: query.block, kind: "block" },
    });

    return parsed.success ? parsed.data : "invalid";
  }

  if (query.ref !== undefined || query.goal !== undefined || query.day !== undefined) {
    try {
      const ref: unknown = typeof query.ref === "string" ? JSON.parse(query.ref) : null;

      const parsed = openStudyDayInputSchema.safeParse({
        goalId: query.goal,
        shownDate: query.day,
        target: { kind: "ref", ref },
      });

      return parsed.success ? parsed.data : "invalid";
    } catch {
      return "invalid";
    }
  }

  return null;
}

export function getCompletionLessonHref(moment: {
  next: { block: { id: string; lessonId: string | null }; opensInPlayer: boolean } | null;
  sessionId: string;
}): string | null {
  const next = moment.next;

  return next?.opensInPlayer && next.block.lessonId
    ? `/learn/${next.block.lessonId}?session=${moment.sessionId}&block=${next.block.id}`
    : null;
}
