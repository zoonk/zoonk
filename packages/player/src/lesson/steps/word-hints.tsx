"use client";

import { LightbulbIcon, MessageCircleMoreIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../_components/lesson-rich-text";
import { type PlayableWordHints } from "../lesson-player-types";

function WordHint({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon: typeof LightbulbIcon;
}) {
  return (
    <p className="flex items-start gap-2">
      <Icon aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * How a word is used and how to say it, from the lesson's word notes and pronunciation tips, with
 * the letters and words they quote formatted as the writer marked them.
 */
export function WordHints({ hints }: { hints: PlayableWordHints }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-2 text-sm" data-slot="lesson-word-hints">
      {hints.note && (
        <WordHint icon={LightbulbIcon}>
          <span className="sr-only">{t("Usage:")} </span>
          <LessonRichText text={hints.note} />
        </WordHint>
      )}

      {hints.pronunciationTip && (
        <WordHint icon={MessageCircleMoreIcon}>
          <span className="sr-only">{t("Pronunciation tip:")} </span>
          <LessonRichText text={hints.pronunciationTip} />
        </WordHint>
      )}
    </div>
  );
}
