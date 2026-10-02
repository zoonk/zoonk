"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRight, Check, CircleDashed, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { type Link, type LinkResult, sameLink } from "./cause-effect-links";

type ListedLink = Link & { state: LinkResult["state"] | "made" };

function StateIcon({ state }: { state: ListedLink["state"] }) {
  if (state === "correct") {
    return <Check aria-hidden="true" className="text-success mt-0.5 size-4 shrink-0" />;
  }

  if (state === "incorrect") {
    return <X aria-hidden="true" className="text-destructive mt-0.5 size-4 shrink-0" />;
  }

  return state === "missed" ? (
    <CircleDashed aria-hidden="true" className="text-success mt-0.5 size-4 shrink-0" />
  ) : null;
}

function useStateLabel() {
  const t = useExtracted();

  return function stateLabel(state: ListedLink["state"]) {
    if (state === "incorrect") {
      return t("Not a link in this story");
    }

    return state === "missed" ? t("Missed link") : null;
  };
}

/**
 * The links in words: what the learner joined, with a way to undo each one, and once confirmed
 * or checked, why each real link holds. This is what screen readers use instead of the arrows.
 */
export function CauseEffectLinkList({
  canRemove,
  explanations,
  labelOf,
  links,
  onRemove,
  showWhy,
}: {
  canRemove: boolean;
  explanations: readonly (Link & { why: string })[];
  labelOf: (id: string) => string;
  links: readonly ListedLink[];
  onRemove: (link: Link) => void;
  showWhy: boolean;
}) {
  const t = useExtracted();
  const stateLabel = useStateLabel();

  if (links.length === 0) {
    return null;
  }

  return (
    <ul aria-label={t("Your links")} className="flex flex-col gap-2" data-slot="cause-effect-links">
      {links.map((link) => {
        const why = explanations.find((item) => sameLink(item, link))?.why;
        const note = stateLabel(link.state);

        return (
          <li
            className={cn(
              "flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm",
              link.state === "missed" && "border-dashed",
            )}
            key={`${link.from}-${link.to}`}
          >
            <StateIcon state={link.state} />

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="flex flex-wrap items-center gap-x-1.5 font-medium">
                <span>{labelOf(link.from)}</span>
                <ArrowRight
                  aria-label={t("led to")}
                  className="text-muted-foreground size-3.5"
                  role="img"
                />
                <span>{labelOf(link.to)}</span>
              </p>

              {note && <p className="text-muted-foreground text-xs">{note}</p>}

              {showWhy && why && link.state !== "incorrect" && (
                <p className="text-muted-foreground leading-relaxed">
                  <LessonRichText text={why} />
                </p>
              )}
            </div>

            {canRemove && (
              <button
                aria-label={t("Remove the link from {cause} to {effect}", {
                  cause: labelOf(link.from),
                  effect: labelOf(link.to),
                })}
                className="text-muted-foreground hover:bg-accent focus-visible:ring-ring/50 -my-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px]"
                onClick={() => onRemove(link)}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
