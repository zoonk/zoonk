"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { type LanguageProgressView } from "@zoonk/core/view-models/language/contract";
import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { getLessonShare } from "@zoonk/core/view-models/syllabus/lesson-share";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { DrawerCloseButton } from "../_components/details-drawer";
import { ListGroup } from "../_components/list-group";
import { useFormatGoalProgress, useFormatShare } from "../_utils/percent";
import { useSkillName } from "../language/_utils/use-skill-name";
import { SpeakingPracticeRow } from "../language/exam-speaking/speaking-practice-screen";
import { CanDoList } from "../language/progress/can-do-list";
import { LevelValue } from "../language/progress/level-value";
import { SkillLevelsCard } from "../language/progress/skill-levels-card";
import { SpeakingMockCard } from "../language/progress/speaking-mock-card";
import { PaceDetails, usePaceNumber } from "./pace-details";
import { NumberButton, type PlanNumber, type PlanNumberVariant } from "./plan-number-button";
import { PreparationDetails } from "./preparation/preparation-details";

const PERCENT = 100;

export type JourneyStanding =
  | {
      forExam: boolean;
      kind: "preparation";
      lessons: SyllabusView["lessons"] | null;
      preparation: NonNullable<ProgressView["preparation"]>;
      stillNeeded: ProgressView["stillNeeded"];
    }
  | {
      kind: "language";
      language: LanguageProgressView;
      speakingHref: string;
      startSpeakingMock: () => Promise<boolean>;
    };

function WeekGain({ gain }: { gain: number }) {
  const t = useExtracted();
  const points = Math.round(gain * PERCENT);

  if (points === 0) {
    return t("No change this week");
  }

  return (
    <span className={cn(points > 0 && "text-success-text")}>
      {points > 0
        ? t("+{points, number} this week", { points })
        : t("{points, number} this week", { points })}
    </span>
  );
}

function useLeadingSkill() {
  const t = useExtracted();
  const skillName = useSkillName();

  return function leadingSkill(levels: LanguageProgressView["levels"]): string | null {
    const [first, ...rest] = levels.toSorted((a, b) => b.score - a.score);

    if (!first) {
      return null;
    }

    if (rest.every((level) => level.score === first.score)) {
      return t("Even across skills");
    }

    return rest[0]?.score === first.score
      ? null
      : t("{skill} leads", { skill: skillName(first.skill) });
  };
}

function useStandingNumber(standing: JourneyStanding): PlanNumber {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const formatGoalProgress = useFormatGoalProgress();
  const leadingSkill = useLeadingSkill();

  if (standing.kind === "preparation" && standing.forExam) {
    return {
      detail: <WeekGain gain={standing.preparation.weekGain} />,
      label: t("Preparation"),
      numeric: true,
      share: standing.preparation.value,
      value: formatShare(standing.preparation.value),
    };
  }

  if (standing.kind === "preparation") {
    const lessons = standing.lessons ?? { done: 0, total: 0 };
    const share = getLessonShare(lessons);

    return {
      detail: t(
        "{total, plural, one {{done, number} of # lesson} other {{done, number} of # lessons}}",
        lessons,
      ),
      label: t("Progress"),
      numeric: true,
      share,
      value: formatGoalProgress(share),
    };
  }

  const { level, levels, target } = standing.language;

  return {
    detail: leadingSkill(levels),
    label: t("Level"),
    numeric: level !== null,
    value: <LevelValue label={level ?? t("Not yet")} target={target?.label ?? null} />,
  };
}

function useStandingTitle(standing: JourneyStanding): string {
  const t = useExtracted();

  if (standing.kind === "language") {
    return t("Your level");
  }

  return standing.forExam ? t("Your preparation") : t("Your progress");
}

function StandingBody({
  examHref,
  standing,
}: {
  examHref: string | null;
  standing: JourneyStanding;
}) {
  if (standing.kind === "preparation") {
    return (
      <PreparationDetails
        examHref={examHref}
        forExam={standing.forExam}
        lessons={standing.lessons}
        preparation={standing.preparation}
        stillNeeded={standing.stillNeeded}
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
        <DrawerHeader className="flex-row items-center justify-between gap-3">
          <DrawerTitle className="text-xl font-semibold">{title}</DrawerTitle>
          <DrawerCloseButton />
        </DrawerHeader>
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
  paused = false,
  standing,
  status,
  variant,
}: {
  className?: string;
  examHref: string | null;
  logbookHref: string | null;
  onAdjust: () => void;
  paused?: boolean;
  standing: JourneyStanding;
  status: PlanView["status"];
  variant: PlanNumberVariant;
}) {
  const t = useExtracted();
  const [open, setOpen] = useState<"pace" | "standing" | null>(null);
  const title = useStandingTitle(standing);
  const standingNumber = useStandingNumber(standing);
  const paceNumber = usePaceNumber({ paused, status: status ?? { kind: "onTrack" } });

  const sheetChange = (sheet: "pace" | "standing") => (next: boolean) =>
    setOpen(next ? sheet : null);

  return (
    <>
      <ul
        className={cn(
          "grid grid-cols-2 items-stretch",
          variant === "tiles" ? "gap-2" : "gap-x-6",
          className,
        )}
        data-slot="journey-standing"
      >
        <li className={cn("min-w-0", !status && "col-span-2")}>
          <NumberButton
            number={standingNumber}
            onOpen={() => setOpen("standing")}
            variant={variant}
          />
        </li>
        {status && (
          <li className="min-w-0">
            <NumberButton number={paceNumber} onOpen={() => setOpen("pace")} variant={variant} />
          </li>
        )}
      </ul>

      <NumberSheet onOpenChange={sheetChange("standing")} open={open === "standing"} title={title}>
        <StandingBody examHref={examHref} standing={standing} />
      </NumberSheet>

      {status && (
        <NumberSheet
          onOpenChange={sheetChange("pace")}
          open={open === "pace"}
          title={t("Your pace")}
        >
          <PaceDetails
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
