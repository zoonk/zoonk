"use client";

import { type LessonWaitingResult } from "@zoonk/core/lookahead/lesson-waiting-state";
import { KindMark } from "@zoonk/learn/kind-tile";
import {
  CURRENT_ROW_CLASS,
  ListRowContent,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "@zoonk/learn/list";
import { PageSection, PageSectionTitle } from "@zoonk/learn/page";
import { useExtracted } from "next-intl";

export type ReadyAlternative = NonNullable<
  Extract<LessonWaitingResult, { status: "ready" }>["state"]["alternative"]
>;

export function ReadyLesson({ alternative }: { alternative: ReadyAlternative }) {
  const t = useExtracted();
  const isLesson = alternative.kind === "lesson";

  return (
    <PageSection className="gap-1">
      <PageSectionTitle>
        {t({
          description:
            "Heading over a lesson or review the learner can start now, while or instead of the lesson that isn't ready.",
          message: "Ready to start now",
        })}
      </PageSectionTitle>

      <ListRowLink
        className={CURRENT_ROW_CLASS}
        href={isLesson ? `/learn/${alternative.lessonId}` : "/today"}
      >
        <ListRowLeading className="size-4 justify-center">
          <KindMark kind={isLesson ? "lesson" : "review"} />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>
            {isLesson
              ? alternative.title
              : t("{count, plural, one {Review # idea} other {Review # ideas}}", {
                  count: alternative.dueSkills,
                })}
          </ListRowTitle>
        </ListRowContent>
      </ListRowLink>
    </PageSection>
  );
}
