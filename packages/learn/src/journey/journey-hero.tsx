"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { type LanguageProgressView } from "@zoonk/core/view-models/language/contract";
import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { getLessonShare } from "@zoonk/core/view-models/syllabus/lesson-share";
import { Drawer, DrawerContent, DrawerPopup, DrawerTitle } from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ListGroup } from "../_components/list-group";
import { SheetHeader } from "../_components/sheet-header";
import { useFormatProgressShare, useFormatShare } from "../_utils/percent";
import { useLanguageNameInSentence } from "../_utils/use-language-name";
import { useLessonsProgressLine } from "../_utils/use-lessons-progress-line";
import { type CallStartOutcome } from "../language/conversation/use-call-start";
import { SpeakingPracticeRow } from "../language/exam-speaking/speaking-practice-screen";
import { CanDoList } from "../language/progress/can-do-list";
import { LevelValue } from "../language/progress/level-value";
import { SkillLevelsCard } from "../language/progress/skill-levels-card";
import { SpeakingMockCard } from "../language/progress/speaking-mock-card";
import { usePlanScreen } from "../plan/plan-context";
import {
  NUMBER_ITEM_CLASS,
  NUMBER_ROWS_CLASS,
  NumberButton,
  type PlanNumber,
  type PlanNumberVariant,
} from "./plan-number-button";
import { PreparationDetails } from "./preparation/preparation-details";
import { type PlanTopics } from "./preparation/use-preparation-parts";
import { ScheduleDetails, useScheduleNumber } from "./schedule-details";

const PERCENT = 100;

export type JourneyStanding =
  | {
      forExam: boolean;
      kind: "preparation";
      lessons: SyllabusView["lessons"] | null;
      preparation: NonNullable<ProgressView["preparation"]>;
      stillNeeded: ProgressView["stillNeeded"];
      topics: PlanTopics | null;
    }
  | {
      kind: "language";
      language: LanguageProgressView;
      speakingHref: string;
      startSpeakingMock: () => Promise<CallStartOutcome>;
    };

function WeekGain({ points }: { points: number }) {
  const t = useExtracted();

  return (
    <span className={cn(points > 0 && "text-success-text")}>
      {points > 0
        ? t("+{points, number} this week", { points })
        : t("{points, number} this week", { points })}
    </span>
  );
}

function useStandingNumber(standing: JourneyStanding): PlanNumber {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const formatProgressShare = useFormatProgressShare();
  const lessonsProgressLine = useLessonsProgressLine();
  const languageName = useLanguageNameInSentence();

  if (standing.kind === "preparation" && standing.forExam) {
    const points = Math.round(standing.preparation.weekGain * PERCENT);

    return {
      detail: points === 0 ? null : <WeekGain points={points} />,
      label: t("Preparation"),
      numeric: true,
      share: standing.preparation.value,
      value: formatShare(standing.preparation.value),
    };
  }

  if (standing.kind === "preparation") {
    const lessons = standing.lessons ?? { done: 0, known: 0, total: 0 };
    const share = getLessonShare(lessons);
    const studied = lessons.done - lessons.known;

    return {
      detail: lessonsProgressLine({ known: lessons.known, studied }),
      label: t("Progress"),
      numeric: true,
      share,
      value: formatProgressShare(share),
    };
  }

  const { goal, level } = standing.language;

  return {
    detail: null,
    label: t("{language} level", { language: languageName(goal.targetLanguage) }),
    numeric: level !== null,
    value: <LevelValue label={level?.label ?? t("Not yet")} target={level?.target ?? null} />,
  };
}

function useStandingTitle(standing: JourneyStanding): string {
  const t = useExtracted();
  const languageName = useLanguageNameInSentence();

  if (standing.kind === "language") {
    return t("Your {language} level", {
      language: languageName(standing.language.goal.targetLanguage),
    });
  }

  return standing.forExam ? t("Your preparation") : t("Your progress");
}

function StandingBody({
  examHref,
  number,
  standing,
}: {
  examHref: string | null;
  number: PlanNumber;
  standing: JourneyStanding;
}) {
  if (standing.kind === "preparation") {
    return (
      <PreparationDetails
        examHref={examHref}
        forExam={standing.forExam}
        lessons={standing.lessons}
        preparation={standing.preparation}
        share={number.share ?? 0}
        stillNeeded={standing.stillNeeded}
        topics={standing.topics}
        value={number.value}
      />
    );
  }

  const { language, speakingHref, startSpeakingMock } = standing;

  return (
    <div className="flex flex-col gap-7">
      <SkillLevelsCard progress={language} />
      <CanDoList canDo={language.canDo} />
      {language.speaking && (
        <ListGroup>
          <SpeakingPracticeRow entry={language.speaking} href={speakingHref} />
        </ListGroup>
      )}
      {language.speakingMock && (
        <SpeakingMockCard
          exam={language.speakingMock}
          onStart={startSpeakingMock}
          paused={language.speakingMockPaused}
        />
      )}
    </div>
  );
}

function NumberSheet({
  children,
  onOpenChange,
  open,
  title,
}: {
  children: React.ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <SheetHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </SheetHeader>
        <DrawerContent className="pt-2">{children}</DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}

export function PlanNumbers({
  className,
  examHref,
  logbookHref,
  onAdjust,
  standing,
  status,
  variant,
}: {
  className?: string;
  examHref: string | null;
  logbookHref: string | null;
  onAdjust: () => void;
  standing: JourneyStanding;
  status: PlanView["status"];
  variant: PlanNumberVariant;
}) {
  const t = useExtracted();
  const { paused = false } = usePlanScreen();
  const [open, setOpen] = useState<"schedule" | "standing" | null>(null);
  const title = useStandingTitle(standing);
  const standingNumber = useStandingNumber(standing);

  const scheduleNumber = useScheduleNumber({
    paused,
    status: status ?? { kind: "onTrack" },
    // The side column's numbers sit above the plan's details, whose "Daily study time" row says it.
    timeShownBeside: variant === "stats",
  });

  const sheetChange = (sheet: "schedule" | "standing") => (next: boolean) =>
    setOpen(next ? sheet : null);

  return (
    <>
      {/* Side by side only where each card's value fits one line in every language. */}
      <div className={cn("@container/standing", className)}>
        <ul
          className={cn(
            "grid @2xl/standing:grid-cols-2",
            NUMBER_ROWS_CLASS,
            variant === "tiles"
              ? "gap-x-2 [&>li+li]:mt-4 @2xl/standing:[&>li+li]:mt-0"
              : "gap-x-6 [&>li+li]:mt-9 @2xl/standing:[&>li+li]:mt-0",
          )}
          data-slot="journey-standing"
        >
          <li className={cn(NUMBER_ITEM_CLASS, "min-w-0", !status && "@2xl/standing:col-span-2")}>
            <NumberButton
              number={standingNumber}
              onOpen={() => setOpen("standing")}
              variant={variant}
            />
          </li>
          {status && (
            <li className={cn(NUMBER_ITEM_CLASS, "min-w-0")}>
              <NumberButton
                number={scheduleNumber}
                onOpen={() => setOpen("schedule")}
                variant={variant}
              />
            </li>
          )}
        </ul>
      </div>

      <NumberSheet onOpenChange={sheetChange("standing")} open={open === "standing"} title={title}>
        <StandingBody examHref={examHref} number={standingNumber} standing={standing} />
      </NumberSheet>

      {status && (
        <NumberSheet
          onOpenChange={sheetChange("schedule")}
          open={open === "schedule"}
          title={t("Your schedule")}
        >
          <ScheduleDetails
            logbookHref={logbookHref}
            onAdjust={() => {
              setOpen(null);
              onAdjust();
            }}
            paused={paused}
            status={status}
          />
        </NumberSheet>
      )}
    </>
  );
}
