"use client";

import { Link } from "@/i18n/navigation";
import { type LessonWaitingResult } from "@zoonk/core/lookahead/lesson-waiting-state";
import { KindMark } from "@zoonk/learn/kind-tile";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";

export type ReadyAlternative = NonNullable<
  Extract<LessonWaitingResult, { status: "ready" }>["state"]["alternative"]
>;

export function ReadyLesson({ alternative }: { alternative: ReadyAlternative }) {
  const t = useExtracted();

  const rowClass =
    "bg-muted hover:bg-muted/70 -mx-2.5 flex min-h-11 items-center gap-3 rounded-[0.625rem] px-2.5 py-2.75 text-sm font-medium transition-colors";

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label">
        {t({
          description:
            "Heading over a lesson or review the learner can start now, while or instead of the lesson that isn't ready.",
          message: "Ready to start now",
        })}
      </h2>
      {alternative.kind === "lesson" ? (
        <Link className={rowClass} href={`/learn/${alternative.lessonId}`}>
          <KindMark kind="lesson" />
          <span className="min-w-0 flex-1 text-balance">{alternative.title}</span>
          <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        </Link>
      ) : (
        <Link className={rowClass} href="/today">
          <KindMark kind="review" />
          <span className="min-w-0 flex-1">
            {t("{count, plural, one {Review # idea} other {Review # ideas}}", {
              count: alternative.dueSkills,
            })}
          </span>
          <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        </Link>
      )}
    </section>
  );
}
