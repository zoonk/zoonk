"use client";

import { PendingAccountAvatar } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar";
import { UserAvatarMenu } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar-menu";
import { useFrameLearner } from "@/components/learner/learner-seed-provider";
import { VisitorLook } from "@/components/learner/visitor-look";
import { Link } from "@/i18n/navigation";
import { useBeltLabel } from "@/lib/belt-label";
import { getMenu } from "@/lib/menu";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor, LEVELS_PER_COLOR } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";
import { Suspense } from "react";

/** Hidden from screen readers: the level link and the account row say it in words. */
export function BeltLevel({
  belt,
  color,
  level,
}: {
  belt: string;
  color: BeltColor;
  level: string;
}) {
  return (
    <>
      <BeltIndicator aria-hidden="true" className="size-2.5" color={color} label={belt} />
      <span aria-hidden="true">{level}</span>
    </>
  );
}

/** It reaches into the bar's gap by its padding. */
const LEVEL_BOX_CLASS = "text-compact -ms-2 h-9 shrink-0 items-center px-2 whitespace-nowrap";

/**
 * The level's room: as wide as the highest level's words, so the bar's end sits in one place for
 * every level and while the learner loads. The mark and its words (`children`) end where the room
 * does.
 */
function LevelRoom({ children }: { children?: React.ReactNode }) {
  const t = useExtracted();

  return (
    <span className="grid tabular-nums *:col-start-1 *:row-start-1 *:flex *:items-center *:gap-1.5">
      <span aria-hidden="true" className="invisible">
        <span className="size-2.5" />
        {t("Level {level}", { level: String(LEVELS_PER_COLOR) })}
      </span>

      {children && <span className="justify-self-end">{children}</span>}
    </span>
  );
}

/** A phone's bar says the level in the sidebar's words ("Level 2"), with the belt's mark before it. */
export function LevelLink({ level }: { level: { color: BeltColor; level: number } }) {
  const t = useExtracted();
  const belt = useBeltLabel(level.color);
  const levelNumber = String(level.level);

  return (
    <Link
      className={cn(
        LEVEL_BOX_CLASS,
        "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 hit-area relative flex rounded-lg transition-colors outline-none focus-visible:ring-[3px]",
      )}
      href={getMenu("stats").url}
      prefetch
      title={t("Statistics")}
    >
      <LevelRoom>
        <BeltLevel
          belt={belt}
          color={level.color}
          level={t("Level {level}", { level: levelNumber })}
        />
      </LevelRoom>
      <span className="sr-only">
        {t("{belt}, level {level}. Statistics", { belt, level: levelNumber })}
      </span>
    </Link>
  );
}

/** A learner's search is the tab bar's last item; a visitor's, with no tab bar, starts the bar. */
type BarEndProps = { visitor: React.ReactNode };

/** The level's room, kept while the learner loads so the bar's end doesn't move when it arrives. */
function PendingLevel() {
  return (
    <span aria-hidden="true" className={cn(LEVEL_BOX_CLASS, "signed-in:flex hidden")}>
      <LevelRoom />
    </span>
  );
}

export function PendingBarEnd({ visitor }: BarEndProps) {
  return (
    <>
      <VisitorLook>{visitor}</VisitorLook>
      <PendingLevel />
      <PendingAccountAvatar className="size-7" />
    </>
  );
}

function BarEnd({ visitor }: BarEndProps) {
  const learner = useFrameLearner();

  if (learner.status === "visitor") {
    return visitor;
  }

  if (learner.status !== "ready") {
    return <PendingBarEnd visitor={visitor} />;
  }

  const { level } = learner.summary;

  return (
    <>
      {level && <LevelLink level={level} />}
      <UserAvatarMenu />
    </>
  );
}

export function LearnBarEnd(props: BarEndProps) {
  return (
    <Suspense fallback={<PendingBarEnd {...props} />}>
      <BarEnd {...props} />
    </Suspense>
  );
}
