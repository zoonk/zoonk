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
import { type BeltColor } from "@zoonk/utils/belt-level";
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

/** The level's room, kept while the learner loads so the bar's end doesn't move when it arrives. */
const LEVEL_BOX_CLASS = "h-9 min-w-12 shrink-0";

function LevelLink({ level }: { level: { color: BeltColor; level: number } }) {
  const t = useExtracted();
  const belt = useBeltLabel(level.color);
  const levelNumber = String(level.level);

  return (
    <Link
      className={cn(
        LEVEL_BOX_CLASS,
        "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 hit-area text-compact relative flex items-center justify-center gap-1.5 rounded-lg px-2 font-mono tabular-nums transition-colors outline-none focus-visible:ring-[3px]",
      )}
      href={getMenu("stats").url}
      prefetch
      title={t("Statistics")}
    >
      <BeltLevel belt={belt} color={level.color} level={levelNumber} />
      <span className="sr-only">
        {t("{belt}, level {level}. Statistics", { belt, level: levelNumber })}
      </span>
    </Link>
  );
}

type BarEndProps = {
  /** A learner's way to the command palette; a visitor's is at the bar's start. */
  search: React.ReactNode;
  visitor: React.ReactNode;
};

function PendingBarEnd({ search, visitor }: BarEndProps) {
  return (
    <>
      <VisitorLook>{visitor}</VisitorLook>
      <div className="signed-in:contents hidden">
        {search}
        <span aria-hidden="true" className={LEVEL_BOX_CLASS} />
      </div>
      <PendingAccountAvatar className="size-7" />
    </>
  );
}

function BarEnd({ search, visitor }: BarEndProps) {
  const learner = useFrameLearner();

  if (learner.status === "visitor") {
    return visitor;
  }

  if (learner.status !== "ready") {
    return <PendingBarEnd search={search} visitor={visitor} />;
  }

  const { level } = learner.summary;

  return (
    <>
      {search}
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
