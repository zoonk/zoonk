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
          description: "The daily time limit is a setting that stops study for the day.",
          message:
            "You've reached your daily time limit. The challenge will be in your next session.",
        })}
      </StudyTimeUsedUpNote>
    );
  }

  if (daysBetween(today, nextStudyDate) === 1) {
    return (
      <StudyTimeUsedUpNote>
        {t({
          description: "The daily time limit is a setting that stops study for the day.",
          message: "You've reached your daily time limit. The challenge will be here tomorrow.",
        })}
      </StudyTimeUsedUpNote>
    );
  }

  return (
    <StudyTimeUsedUpNote>
      {t({
        description:
          'The daily time limit is a setting that stops study for the day. {day} is a weekday, like "Monday".',
        message: "You've reached your daily time limit. The challenge will be here on {day}.",
        values: { day: formatDate(nextStudyDate, "weekday") },
      })}
    </StudyTimeUsedUpNote>
  );
}

/**
 * Past the daily time limit the week's challenge doesn't come back on its own: the next study day
 * re-plans without it (RULES R24).
 */
export function WeeklyUsedUpLine({ movable }: { movable: boolean }) {
  const t = useExtracted();

  return (
    <StudyTimeUsedUpNote>
      {movable
        ? t({
            description: "The daily time limit is a setting that stops study for the day.",
            message:
              "You've reached your daily time limit. Move the challenge to Monday to keep it.",
          })
        : t({
            description:
              "The daily time limit is a setting that stops study for the day. The weekly challenge can't move to another day, so the learner misses it this week.",
            message: "You've reached your daily time limit. You'll miss this week's challenge.",
          })}
    </StudyTimeUsedUpNote>
  );
}
