"use client";

import { PendingAccountAvatar } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar";
import { UserAvatarMenu } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar-menu";
import { useFrameLearner } from "@/components/learner/learner-seed-provider";
import { VisitorLook } from "@/components/learner/visitor-look";
import { Link } from "@/i18n/navigation";
import { useBeltLabel } from "@/lib/belt-label";
import { getMenu } from "@/lib/menu";
import { LearnShellEnd } from "@zoonk/learn/shell";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
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

function LevelLink({ level }: { level: { color: BeltColor; level: number } }) {
  const t = useExtracted();
  const belt = useBeltLabel(level.color);
  const levelNumber = String(level.level);

  return (
    <Link
      className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 hit-area text-compact relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 font-mono tabular-nums transition-colors outline-none focus-visible:ring-[3px]"
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
    <LearnShellEnd>
      <VisitorLook>{visitor}</VisitorLook>
      <div className="signed-in:contents hidden">{search}</div>
      <PendingAccountAvatar className="size-7" />
    </LearnShellEnd>
  );
}

function BarEnd({ search, visitor }: BarEndProps) {
  const learner = useFrameLearner();

  if (learner.status === "visitor") {
    return <LearnShellEnd>{visitor}</LearnShellEnd>;
  }

  if (learner.status !== "ready") {
    return <PendingBarEnd search={search} visitor={visitor} />;
  }

  const { level } = learner.summary;

  return (
    <LearnShellEnd>
      {search}
      {level && <LevelLink level={level} />}
      <UserAvatarMenu />
    </LearnShellEnd>
  );
}

export function LearnBarEnd(props: BarEndProps) {
  return (
    <Suspense fallback={<PendingBarEnd {...props} />}>
      <BarEnd {...props} />
    </Suspense>
  );
}
