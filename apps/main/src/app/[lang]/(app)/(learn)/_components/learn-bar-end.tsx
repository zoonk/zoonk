import { UserAvatarMenu } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar-menu";
import { VisitorBarLinks } from "@/components/login-bar-link";
import { Link } from "@/i18n/navigation";
import { getBeltLabel } from "@/lib/belt-colors";
import { getMenu } from "@/lib/menu";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getSession } from "@zoonk/core/users/session";
import { LearnAvatarBelt } from "@zoonk/learn/avatar-belt";
import { LearnShellEnd } from "@zoonk/learn/shell";
import { AvatarSkeleton } from "@zoonk/ui/components/avatar";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

/** The account avatar's place while the session is read, at its size in the bar (28px). */
const AVATAR_SKELETON_CLASS = "size-7";

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
 * grows, in sight on every tab, and the shortest way to the rest. Nothing before they have a level.
 */
async function LevelLink() {
  const level = await getBeltLevel();

  if (!level) {
    return null;
  }

  const t = await getExtracted();
  const belt = await getBeltLabel({ color: level.color });
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
 * The right of the learner's top bar: their belt and level opening Statistics (`stats`, on the
 * tabs), and the account avatar. A visitor has no account to open, so Pricing and the way in stand
 * there, as in the sidebar and the catalog's bar; the search field's palette holds what the menu
 * would.
 * Without the level link (as in onboarding) the avatar wears the belt as a dot. Energy lives on
 * the buddy's tab, and search opens with Cmd/Ctrl+K or from the avatar's menu.
 */
export async function LearnBarEnd({ stats = false }: { stats?: boolean }) {
  const [session, level] = await Promise.all([getSession(), getBeltLevel()]);
  const showLevel = stats && level !== null;

  if (!session) {
    return (
      <LearnShellEnd>
        <VisitorBarLinks />
      </LearnShellEnd>
    );
  }

  return (
    <LearnShellEnd>
      {showLevel && <LevelLink />}
      <LearnAvatarBelt color={showLevel ? null : (level?.color ?? null)}>
        <Suspense fallback={<AvatarSkeleton className={AVATAR_SKELETON_CLASS} />}>
          <UserAvatarMenu />
        </Suspense>
      </LearnAvatarBelt>
    </LearnShellEnd>
  );
}

export function LearnBarEndSkeleton() {
  return (
    <LearnShellEnd>
      <AvatarSkeleton className={AVATAR_SKELETON_CLASS} />
    </LearnShellEnd>
  );
}
