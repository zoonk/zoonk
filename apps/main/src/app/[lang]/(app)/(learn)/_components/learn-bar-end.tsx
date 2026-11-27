"use client";

import { PendingAccountAvatar } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar";
import { UserAvatarMenu } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar-menu";
import { useFrameLearner } from "@/components/learner/learner-seed-provider";
import { VisitorLook } from "@/components/learner/visitor-look";
import { Link } from "@/i18n/navigation";
import { useBeltLabel } from "@/lib/belt-label";
import { getMenu } from "@/lib/menu";
import { LearnLevelLink, PendingLevel } from "@zoonk/learn/level-link";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { Suspense } from "react";

export function LevelLink({ level }: { level: { color: BeltColor; level: number } }) {
  const belt = useBeltLabel(level.color);

  return <LearnLevelLink belt={belt} href={getMenu("level").url} level={level} link={Link} />;
}

/** A learner's search is the tab bar's last item; a visitor's, with no tab bar, starts the bar. */
type BarEndProps = { visitor: React.ReactNode };

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
