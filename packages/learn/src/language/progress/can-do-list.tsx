"use client";

import { type LanguageProgressView } from "@zoonk/core/view-models/language/contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon, CircleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SectionLabel } from "../../_components/section-label";

/**
 * "I can already…": what the learner can do in real life, from the units they finished (checked),
 * and the one thing they're working toward next (still open), in the words of each unit's
 * objectives. The rest of the unit they're in waits for its page.
 */
export function CanDoList({ canDo: all }: { canDo: LanguageProgressView["canDo"] }) {
  const t = useExtracted();
  const next = all.find((item) => !item.done);
  const canDo = [...all.filter((item) => item.done), ...(next ? [next] : [])];

  if (canDo.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="language-can-do" className="flex flex-col gap-3">
      <SectionLabel id="language-can-do">{t("I can already…")}</SectionLabel>
      <ul className="flex flex-col gap-2.5">
        {canDo.map((item) => (
          <li
            className={cn("flex items-start gap-3", !item.done && "text-muted-foreground")}
            key={`${item.unitTitle}-${item.text}`}
          >
            <LineMarker aria-hidden="true">
              {item.done ? (
                <CircleCheckIcon className="text-success size-5" />
              ) : (
                <CircleIcon className="size-5 opacity-50" />
              )}
            </LineMarker>
            <span>
              {item.text}
              {!item.done && <span className="sr-only">{t(", not yet")}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
