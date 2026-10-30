"use client";

import { useExtracted } from "next-intl";
import { StudyTimeUsedUpNote } from "../_components/study-time-used-up";
import { daysBetween, useFormatIsoDate } from "../_utils/iso-date";

export function ChallengeUsedUpLine({
  nextStudyDate,
  today,
}: {
  nextStudyDate?: string | null;
  today?: string;
}) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  if (!nextStudyDate || !today) {
    return (
      <StudyTimeUsedUpNote>
        {t({
          description: "Study time is the learner's daily amount.",
          message: "You've reached today's study time. The challenge will be in your next session.",
        })}
      </StudyTimeUsedUpNote>
    );
  }

  if (daysBetween(today, nextStudyDate) === 1) {
    return (
      <StudyTimeUsedUpNote>
        {t({
          description: "Study time is the learner's daily amount.",
          message: "You've reached today's study time. The challenge will be here tomorrow.",
        })}
      </StudyTimeUsedUpNote>
    );
  }

  return (
    <StudyTimeUsedUpNote>
      {t({
        description:
          'Study time is the learner\'s daily amount. {day} is a weekday, like "Monday".',
        message: "You've reached today's study time. The challenge will be here on {day}.",
        values: { day: formatDate(nextStudyDate, "weekday") },
      })}
    </StudyTimeUsedUpNote>
  );
}

/**
 * Past today's study time the week's challenge doesn't come back on its own: the next study day
 * re-plans without it (RULES R24).
 */
export function WeeklyUsedUpLine({ movable }: { movable: boolean }) {
  const t = useExtracted();

  return (
    <StudyTimeUsedUpNote>
      {movable
        ? t({
            description: "Study time is the learner's daily amount.",
            message: "You've reached today's study time. Move the challenge to Monday to keep it.",
          })
        : t({
            description: "Study time is the learner's daily amount.",
            message: "You've reached today's study time.",
          })}
    </StudyTimeUsedUpNote>
  );
}
