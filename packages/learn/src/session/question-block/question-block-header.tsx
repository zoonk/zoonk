"use client";

import { type ContentVoteTarget } from "@zoonk/core/feedback/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ContentVoteMenu } from "../../feedback/content-vote-menu";
import { LearnLink } from "../../learn-link";
import { useExperienceMode } from "../../mode-provider";
import { SessionBar } from "../session-bar";

/** Hyperdrive shows from a double; Focus counts it without showing it. */
const MIN_SHOWN_HYPERDRIVE = 2;

/**
 * The block's header: close (progress is kept), what the block is (the page's heading), how far
 * into it the learner is, in Fun the live Hyperdrive, and the question's "…" menu to vote on it.
 * The session bar sits under it.
 */
export function QuestionBlockHeader({
  exitHref,
  hyperdrive,
  index,
  sessionBar,
  title,
  total,
  voteTarget,
}: {
  exitHref: string;
  hyperdrive: number;
  index: number;
  sessionBar: { completed: number; total: number };
  title: string;
  total: number;
  /** The question to vote on, when it can be voted on now. */
  voteTarget: ContentVoteTarget | null;
}) {
  const t = useExtracted();
  const mode = useExperienceMode();
  const showHyperdrive = mode === "fun" && hyperdrive >= MIN_SHOWN_HYPERDRIVE;

  return (
    <header className="flex flex-col gap-3">
      {/* Close and the menu sit on the title's first line, even when a long title wraps. */}
      <div className="flex items-start gap-3">
        <LineMarker>
          <LearnLink
            aria-label={t("Close. Your answers are saved.")}
            className={cn(buttonVariants({ size: "icon-lg", variant: "ghost" }), "rounded-full")}
            href={exitHref}
            prefetch={false}
          >
            <XIcon aria-hidden="true" />
          </LearnLink>
        </LineMarker>

        {/* The title gets the row's width and wraps; Hyperdrive rides on the count's line. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="font-semibold wrap-break-word">{title}</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
              {t("{current} of {total}", {
                current: String(Math.min(index + 1, total)),
                total: String(total),
              })}
            </p>

            {showHyperdrive && (
              <p
                aria-live="polite"
                className="fun-glass text-fun-accent-violet flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap"
              >
                <ZapIcon aria-hidden="true" className="size-3.5" />
                {t("Hyperdrive x{level}", { level: String(hyperdrive) })}
              </p>
            )}
          </div>
        </div>

        {voteTarget && (
          <LineMarker>
            <ContentVoteMenu
              label={t("Question options")}
              screen="question-block"
              target={voteTarget}
            />
          </LineMarker>
        )}
      </div>

      <SessionBar completed={sessionBar.completed} total={sessionBar.total} />
    </header>
  );
}
