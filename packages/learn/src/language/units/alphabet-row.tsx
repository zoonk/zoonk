"use client";

import { Button } from "@zoonk/ui/components/button";
import { ChevronRightIcon, LanguagesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { LearnLink } from "../../learn-link";
import { LANGUAGE_ROW_LINK_CLASS } from "../current-unit";

/** The script's alphabet lesson as Content lists it, and whether it still opens the sessions. */
export type AlphabetLink = { href: string; minutes: number; pending: boolean; title: string };

/**
 * The alphabet lesson of a script that isn't Latin, open as practice anytime. While it still
 * opens the learner's sessions, they can say they already read the script and skip it.
 */
export function AlphabetRow({
  alphabet,
  onSkip,
}: {
  alphabet: AlphabetLink;
  /** Resolves false when the skip couldn't be saved. */
  onSkip: () => Promise<boolean>;
}) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const skip = () =>
    startTransition(async () => {
      setFailed(!(await onSkip()));
    });

  return (
    <div className="flex flex-col gap-2">
      <LearnLink className={LANGUAGE_ROW_LINK_CLASS} href={alphabet.href}>
        <span
          aria-hidden="true"
          className="bg-background text-muted-foreground in-data-[mode=fun]:bg-fun-soft flex size-9 shrink-0 items-center justify-center rounded-xl"
        >
          <LanguagesIcon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-muted-foreground text-xs">
            {alphabet.pending
              ? t("First in your next session · {minutes, number} min", {
                  minutes: alphabet.minutes,
                })
              : t("Practice anytime · {minutes, number} min", { minutes: alphabet.minutes })}
          </span>
          <span className="font-medium">{alphabet.title}</span>
        </span>
        <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      </LearnLink>

      {alphabet.pending && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Button disabled={isPending} onClick={skip} size="sm" variant="ghost">
            {t("I can already read it")}
          </Button>
          {failed && (
            <p className="text-destructive text-sm" role="alert">
              {t("That didn't save. Try again.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
