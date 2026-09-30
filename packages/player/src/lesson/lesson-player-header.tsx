"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { HyperdriveBadge } from "./_components/hyperdrive-badge";
import { MIN_SHOWN_HYPERDRIVE } from "./_utils/lesson-hyperdrive";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { LessonScreenMenu } from "./lesson-screen-menu";

/**
 * An icon button on phones; with a keyboard at desktop size it widens to hold its "Esc" hint
 * inline, like the main action's "Enter", instead of a badge over the icon.
 */
function LessonCloseLink() {
  const t = useExtracted();
  const { linkComponent: LinkComponent, routes } = useLessonPlayerConfig();

  return (
    <LinkComponent
      aria-keyshortcuts="Escape"
      className={cn(
        buttonVariants({ size: "icon", variant: "ghost" }),
        "lg:pointer-fine:w-auto lg:pointer-fine:gap-1.5 lg:pointer-fine:px-2.5",
      )}
      href={routes.exit}
    >
      <XIcon />
      <ShortcutKbd>Esc</ShortcutKbd>
      <span className="sr-only">{t("Close lesson")}</span>
    </LinkComponent>
  );
}

/** Close on the left, the skin's center (title or dots) and room for the session bar below. */
export function LessonPlayerHeader() {
  const { lesson, skin, slots } = useLessonPlayerConfig();
  const { screen } = useLessonPlayer();
  const { HeaderCenter, ProgressBar } = skin;

  return (
    <div className="shrink-0" data-slot="lesson-player-header">
      <header className="flex items-center gap-2 px-3 py-2 sm:px-4 xl:py-3">
        <LessonCloseLink />
        <div className="min-w-0 flex-1">
          <HeaderCenter
            minutes={lesson.estimatedMinutes}
            progress={screen.progress}
            title={lesson.title}
          />
        </div>
        <LessonScreenMenu />
        {/* Fun keeps the badge's room so the dots don't shift when Hyperdrive lights up. */}
        {skin.showsHyperdrive &&
          (screen.hyperdriveLevel >= MIN_SHOWN_HYPERDRIVE ? (
            <HyperdriveBadge level={screen.hyperdriveLevel} />
          ) : (
            <span aria-hidden="true" className="size-9 shrink-0" />
          ))}
      </header>

      <ProgressBar current={screen.progress.current} total={screen.progress.total} />
      {slots.sessionBar}
    </div>
  );
}
