import { UserAvatarMenu } from "@/app/[lang]/(catalog)/_components/user-avatar-menu";
import { LoginBarLink } from "@/components/login-bar-link";
import { Link } from "@/i18n/navigation";
import { getBeltLabel } from "@/lib/belt-colors";
import { getMenu } from "@/lib/menu";
import { type BeltLevelDetails, getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getSession } from "@zoonk/core/users/session";
import { LearnAvatarBelt } from "@zoonk/learn/avatar-belt";
import { LearnShellEnd } from "@zoonk/learn/shell";
import { AvatarSkeleton } from "@zoonk/ui/components/avatar";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

/** The account avatar's place while the session is read, at its size in the bar. */
const AVATAR_SKELETON_CLASS = "size-11 lg:size-10";

/** A visitor (the catalog is open to them) gets the public pages' way in, in plain sight. */
async function VisitorLogin() {
  const session = await getSession();
  return session ? null : <LoginBarLink />;
}

/**
 * The learner's belt and level, opening their statistics: the one number of theirs that only
 * grows, in sight on every tab, and the shortest way to the rest.
 */
async function LevelLink({ level }: { level: BeltLevelDetails }) {
  const [t, belt] = await Promise.all([getExtracted(), getBeltLabel({ color: level.color })]);
  const levelNumber = String(level.level);

  return (
    <Link
      className="border-border bg-background hover:bg-muted focus-visible:ring-ring/50 hit-area relative flex h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold tabular-nums transition-colors outline-none focus-visible:ring-[3px] lg:h-10"
      href={getMenu("stats").url}
      prefetch
      title={t("Statistics")}
    >
      <BeltIndicator aria-hidden="true" color={level.color} label={belt} />
      <span aria-hidden="true">{levelNumber}</span>
      <span className="sr-only">
        {t("{belt}, level {level}. Statistics", { belt, level: levelNumber })}
      </span>
    </Link>
  );
}

/**
 * The right of the learner's top bar: their belt and level opening Statistics (`stats`, on the
 * tabs), and the account avatar; for a visitor the way in beside it. Without the level link (as
 * in onboarding) the avatar wears the belt as a dot. Energy lives on the buddy's tab, and search
 * opens with Cmd/Ctrl+K or from the avatar's menu.
 */
export async function LearnBarEnd({ stats = false }: { stats?: boolean }) {
  const level = await getBeltLevel();
  const showLevel = stats && level !== null;

  return (
    <LearnShellEnd>
      <VisitorLogin />
      {showLevel && <LevelLink level={level} />}
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
