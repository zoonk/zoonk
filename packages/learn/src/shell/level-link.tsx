import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor, LEVELS_PER_COLOR } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";
import { type ComponentType, type ReactNode } from "react";

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

const LEVEL_BOX_CLASS = "text-compact -ms-2 h-9 shrink-0 items-center px-2 whitespace-nowrap";

/**
 * The level's room: as wide as the highest level, so the bar's end sits in one place for every
 * level and while the learner loads. The bar shows only under `lg`, where there's no room for the
 * word "Level"; its title and spoken name say it. The mark and its number (`children`) end where
 * the room does.
 */
function LevelRoom({ children }: { children?: ReactNode }) {
  return (
    <span className="grid tabular-nums *:col-start-1 *:row-start-1 *:flex *:items-center *:gap-1.5">
      <span aria-hidden="true" className="invisible">
        <span className="size-2.5" />
        {LEVELS_PER_COLOR}
      </span>

      {children && <span className="justify-self-end">{children}</span>}
    </span>
  );
}

export function LearnLevelLink({
  belt,
  href,
  level,
  link: Link,
}: {
  belt: string;
  href: "/level";
  level: { color: BeltColor; level: number };
  link: ComponentType<{
    children: ReactNode;
    className: string;
    href: "/level";
    prefetch: true;
    title: string;
  }>;
}) {
  const t = useExtracted();
  const levelNumber = String(level.level);

  return (
    <Link
      className={cn(
        LEVEL_BOX_CLASS,
        "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 hit-area relative flex rounded-lg transition-colors outline-none focus-visible:ring-[3px]",
      )}
      href={href}
      prefetch
      title={t("Level")}
    >
      <LevelRoom>
        <BeltLevel belt={belt} color={level.color} level={levelNumber} />
      </LevelRoom>
      <span className="sr-only">
        {t({
          description:
            "Accessible name of the chip that opens Level. belt is the translated belt name; level is the learner’s level number. Each locale controls their order and punctuation.",
          message: "{belt}, Level {level}",
          values: { belt, level: levelNumber },
        })}
      </span>
    </Link>
  );
}

/** The level's room, kept while the learner loads so the bar's end doesn't move when it arrives. */
export function PendingLevel() {
  return (
    <span aria-hidden="true" className={cn(LEVEL_BOX_CLASS, "signed-in:flex hidden")}>
      <LevelRoom />
    </span>
  );
}
