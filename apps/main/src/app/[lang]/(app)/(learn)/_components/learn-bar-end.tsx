"use client";

import { PendingAccountAvatar } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar";
import { UserAvatarMenu } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar-menu";
import { VisitorLook } from "@/components/learner/visitor-look";
import { Link } from "@/i18n/navigation";
import { useBeltLabel } from "@/lib/belt-label";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { getMenu } from "@/lib/menu";
import { LearnAvatarBelt } from "@zoonk/learn/avatar-belt";
import { LearnShellEnd } from "@zoonk/learn/shell";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";

/**
 * The learner's belt as a dot and their level in mono, as the top bar's level link and the
 * sidebar's account row show them. Both say it in words for screen readers, so it's hidden here.
 */
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

/**
 * The learner's belt and level, opening their statistics: the one number of theirs that only
 * grows, in sight on every tab, and the shortest way to the rest.
 */
function LevelLink({ level }: { level: { color: BeltColor; level: number } }) {
  const t = useExtracted();
  const belt = useBeltLabel(level.color);
  const levelNumber = String(level.level);

  return (
    <Link
      className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 hit-area relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 font-mono text-[0.8125rem] tabular-nums transition-colors outline-none focus-visible:ring-[3px]"
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

/**
 * The bar's end while the learner is unread: a visitor's Pricing and way in, or on a page marked
 * signed in the account's quiet avatar at its size in the bar (28px).
 */
function PendingBarEnd({ visitor }: { visitor: React.ReactNode }) {
  return (
    <LearnShellEnd>
      <VisitorLook>{visitor}</VisitorLook>
      <PendingAccountAvatar className="size-7" />
    </LearnShellEnd>
  );
}

/**
 * The right of the learner's top bar: their belt and level opening Statistics (`stats`, on the
 * tabs), and the account avatar. A visitor has no account to open, so Pricing and the way in
 * (`visitor`) stand there, as in the sidebar and the catalog's bar; the search field's palette
 * holds what the menu would. Nothing of a level before the learner has one.
 * Without the level link (as in onboarding) the avatar wears the belt as a dot. Energy lives on
 * the buddy's tab, and search opens with Cmd/Ctrl+K or from the avatar's menu.
 */
export function LearnBarEnd({
  stats = false,
  visitor,
}: {
  stats?: boolean;
  visitor: React.ReactNode;
}) {
  const learner = useLearnerSummary();

  if (learner.status === "visitor") {
    return <LearnShellEnd>{visitor}</LearnShellEnd>;
  }

  if (learner.status !== "ready") {
    return <PendingBarEnd visitor={visitor} />;
  }

  const { level } = learner.summary;
  const shownLevel = stats ? level : null;

  return (
    <LearnShellEnd>
      {shownLevel && <LevelLink level={shownLevel} />}
      <LearnAvatarBelt color={shownLevel ? null : (level?.color ?? null)}>
        <UserAvatarMenu />
      </LearnAvatarBelt>
    </LearnShellEnd>
  );
}
