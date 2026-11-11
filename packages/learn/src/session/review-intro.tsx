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

const STARTS_KEY = "zoonk:review-intro-starts";

/** A daily learner reads it open a few times, then it folds to one row they can reopen. */
const OPEN_FOR_STARTS = 3;

function readStarts(): number {
  return Number(deviceStorage.get(STARTS_KEY)) || 0;
}

export function noteReviewStart(block: DayStep): void {
  if (hasCapsules(block)) {
    deviceStorage.set(STARTS_KEY, String(readStarts() + 1));
  }
}

function useOpenAtFirst(): boolean {
  return useSyncExternalStore(
    subscribeToDeviceStorage,
    () => readStarts() < OPEN_FOR_STARTS,
    () => true,
  );
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

/** What a review is and how it picks its questions, for a learner who never asked. */
export function ReviewIntro({ block }: { block: DayStep }) {
  const t = useExtracted();
  const open = useOpenAtFirst();

  if (block.kind !== "review") {
    return null;
  }

  // The first week's warm-up is only placement's questions: it checks, it doesn't review.
  if (!hasCapsules(block)) {
    return (
      <p className="text-muted-foreground text-sm text-pretty">
        {t("A few quick questions to check what you already know.")}
      </p>
    );
  }

  return (
    <ListGroup>
      <Disclosure
        defaultOpen={open}
        icon={
          <ListRowIcon>
            <RotateCcwIcon />
          </ListRowIcon>
        }
        key={open ? "open" : "closed"}
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
