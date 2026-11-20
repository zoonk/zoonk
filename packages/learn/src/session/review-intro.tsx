"use client";

import {
  CalendarClockIcon,
  HourglassIcon,
  RotateCcwIcon,
  TargetIcon,
  TimerIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useSyncExternalStore } from "react";
import { Disclosure } from "../_components/disclosure";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import { deviceStorage, subscribeToDeviceStorage } from "../_utils/device-storage";
import { type DayStep } from "./session-types";
import { hasCapsules } from "./use-block-copy";

function getStartsKey(goalId: string): string {
  return `zoonk:review-intro-starts:${goalId}`;
}

/** A review says what it is the first few times a learner starts one, then names its topics. */
const INTRO_FOR_STARTS = 3;

/** Counted per goal, so a learner sharing the device still gets the line. */
function readStarts(goalId: string): number {
  return Number(deviceStorage.get(getStartsKey(goalId))) || 0;
}

export function noteReviewStart({ block, goalId }: { block: DayStep; goalId: string }): void {
  if (hasCapsules(block)) {
    deviceStorage.set(getStartsKey(goalId), String(readStarts(goalId) + 1));
  }
}

function useIsNewToReviews(goalId: string): boolean {
  return useSyncExternalStore(
    subscribeToDeviceStorage,
    () => readStarts(goalId) < INTRO_FOR_STARTS,
    () => true,
  );
}

/**
 * The one line under a review's name: what a review is at first, then what's in it (`detail`). The
 * first week's warm-up is only test questions: it checks, it doesn't review.
 */
export function useReviewLine({
  block,
  detail,
  goalId,
}: {
  block: DayStep;
  detail: string | null;
  goalId: string;
}): string | null {
  const t = useExtracted();
  const isNew = useIsNewToReviews(goalId);

  if (block.kind !== "review") {
    return detail;
  }

  if (!hasCapsules(block)) {
    return t("A short test, so your plan skips what you know.");
  }

  return isNew ? t("Questions on what you studied before, so it stays with you.") : detail;
}

function IntroRow({
  description,
  icon,
  title,
}: {
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <ListRow>
      <ListRowLeading>
        <ListRowIcon>{icon}</ListRowIcon>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{title}</ListRowTitle>
        <ListRowDescription>{description}</ListRowDescription>
      </ListRowContent>
    </ListRow>
  );
}

function WhyRow({ weakest }: { weakest: boolean }) {
  const t = useExtracted();

  if (weakest) {
    return (
      <IntroRow
        description={t(
          "Nothing is close to being forgotten, so you practice what's been hardest for you.",
        )}
        icon={<TargetIcon />}
        title={t("Your hardest topics today")}
      />
    );
  }

  return (
    <IntroRow
      description={t("Each idea you study comes back right before you'd start to forget it.")}
      icon={<HourglassIcon />}
      title={t("Just before you forget")}
    />
  );
}

/** How a review picks its questions, behind one row, for the learner who asks. */
export function ReviewIntro({ block }: { block: DayStep }) {
  const t = useExtracted();

  if (!hasCapsules(block)) {
    return null;
  }

  return (
    <ListGroup>
      <Disclosure
        icon={
          <ListRowIcon>
            <RotateCcwIcon />
          </ListRowIcon>
        }
        title={t("How reviews work")}
      >
        <ListGroup>
          <WhyRow weakest={block.weakest} />
          <IntroRow
            description={t(
              "Get it right and it returns in days, then weeks, then months. Miss it and it's back sooner.",
            )}
            icon={<CalendarClockIcon />}
            title={t("Right answers wait longer")}
          />
          <IntroRow
            description={t(
              "Reviews open your session and take a small part of it, even after days away.",
            )}
            icon={<TimerIcon />}
            title={t("First, and always short")}
          />
        </ListGroup>
      </Disclosure>
    </ListGroup>
  );
}
