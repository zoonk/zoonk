"use client";

import { type LibraryLessonCompletion } from "@zoonk/core/lesson-player/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { useChangeSaveFailed } from "../_components/save-error";
import { Surface } from "../_components/surface";
import { TASK_WRAPPING_ACTION_CLASS } from "../_components/task-layout";
import { LearnLink } from "../learn-link";

export type LevelCheckOffer = NonNullable<LibraryLessonCompletion["placementOffer"]>;

type HostLink = React.ComponentType<{
  className?: string;
  children: React.ReactNode;
  href: string;
}>;

/** A level test-out names its level; the quick test takes none. */
function readOfferLevel(offer: LevelCheckOffer): string | null {
  return "level" in offer && typeof offer.level === "string" ? offer.level : null;
}

/**
 * After a run of easy lessons, a lesson's end offers a check that can skip what the learner already
 * knows. "Not now" is saved, so the same offer waits until something new happens.
 */
export function LevelCheckOfferCard({
  href,
  link: Link = LearnLink,
  offer,
  onDismiss,
}: {
  href: string;
  /** The host's own link, where the screen runs outside the app's learn context. */
  link?: HostLink;
  offer: LevelCheckOffer;
  /** Resolves whether "Not now" was saved. */
  onDismiss: () => Promise<boolean>;
}) {
  const t = useExtracted();
  const saveFailed = useChangeSaveFailed();
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const level = readOfferLevel(offer);

  if (dismissed) {
    return null;
  }

  const dismiss = () =>
    startTransition(async () => {
      const saved = await onDismiss().catch(() => false);

      if (saved) {
        setDismissed(true);
        return;
      }

      saveFailed();
    });

  return (
    <Surface className="flex flex-col gap-4 p-4" data-slot="level-check-offer">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">{t("This looks easy for you")}</h2>
        <p className="text-muted-foreground text-sm text-pretty">
          {level
            ? t("A short test can skip {level} if you already know it.", { level })
            : t("A quick check can skip lessons you already know.")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          className={cn(buttonVariants({ variant: "outline" }), TASK_WRAPPING_ACTION_CLASS)}
          href={href}
        >
          {level ? t("Test out of {level}", { level }) : t("Test what you know")}
        </Link>
        <Button busy={isPending} onClick={dismiss} variant="ghost">
          {t("Not now")}
        </Button>
      </div>
    </Surface>
  );
}
