"use client";

import { type ExplanationView } from "@zoonk/core/view-models/explain/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, ChevronRightIcon, LightbulbIcon, TargetIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { FactChip, FactChips } from "../_components/fact-chips";
import { LearnLink } from "../learn-link";

/** What the check earned, once the explanation is saved. */
type ExplainResult = { answered: number; brainPower: number | null; correct: number };

const CARD_CLASS = "bg-card ring-foreground/10 rounded-3xl p-4 ring-1 sm:p-5";

function GoFurtherRow({
  description,
  href,
  icon,
  title,
}: {
  description: string;
  href: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <li>
      <LearnLink
        className="hover:bg-muted/60 focus-visible:ring-ring/50 -mx-2 flex min-h-14 items-center gap-3 rounded-2xl px-2 py-2 outline-none focus-visible:ring-[3px]"
        href={href}
      >
        <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5">
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground text-sm">{description}</span>
        </span>
        <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      </LearnLink>
    </li>
  );
}

const DONE_CLASS = cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base");

/**
 * "Done" leaves the explanation, read to the end, once its reading is saved (`saving` until then):
 * that save is what finishes the explanation, so it leaves the goal switcher.
 */
function DoneLink({ href, saving }: { href: string; saving: boolean }) {
  const t = useExtracted();
  const doneRef = useEnterClick<HTMLAnchorElement>();

  if (saving) {
    return (
      <Button aria-busy className={DONE_CLASS} disabled focusableWhenDisabled>
        {t("Done")}
      </Button>
    );
  }

  return (
    <LearnLink className={DONE_CLASS} href={href} ref={doneRef}>
      {t("Done")}
    </LearnLink>
  );
}

/**
 * The end of a quick explanation: "Now you know", the recap in three sentences, what the one
 * question earned, and "Want to go further?": learning the subject in depth as a plan of its own
 * (the host's `deeper` control) or another quick question. One button finishes; a problem with it
 * is reported from the lesson's "…" menu.
 */
export function ExplainEnding({
  deeper,
  doneHref,
  explanation,
  questionHref,
  result,
  saving = false,
}: {
  /** "I want to learn this in depth": `ExplainDeeperButton` or `ExplainDeeperLink`. */
  deeper: React.ReactNode;
  doneHref: string;
  explanation: Pick<ExplanationView, "goFurther" | "recap" | "title">;
  /** Where a related question starts: onboarding with the question filled in. */
  questionHref: (question: string) => string;
  result: ExplainResult;
  /** While the reading is being saved, "Done" waits for it. */
  saving?: boolean;
}) {
  const t = useExtracted();
  const { questions } = explanation.goFurther;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      <span className="bg-success/10 text-success flex size-12 items-center justify-center rounded-full">
        <CheckIcon aria-hidden="true" className="size-6" />
      </span>

      <div className="flex flex-col gap-1" role="status">
        <p className="text-muted-foreground text-sm font-medium">{t("Now you know")}</p>
        <h2 className="text-3xl font-semibold tracking-tight text-balance">{explanation.title}</h2>
        {(result.answered > 0 || Boolean(result.brainPower)) && (
          <FactChips className="mt-2">
            {result.answered > 0 && (
              <FactChip>
                <TargetIcon aria-hidden="true" />
                {t("{correct, number} of {answered, number} right", {
                  answered: result.answered,
                  correct: result.correct,
                })}
              </FactChip>
            )}
            {/* Read again, it earns nothing new: "+0" would only read as a loss. */}
            {Boolean(result.brainPower) && (
              <FactChip>
                <ZapIcon aria-hidden="true" />
                {t("+{points, number} Brain Power", { points: result.brainPower ?? 0 })}
              </FactChip>
            )}
          </FactChips>
        )}
      </div>

      {explanation.recap.length > 0 && (
        <section aria-labelledby="explain-recap" className={CARD_CLASS}>
          <h3
            className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase"
            id="explain-recap"
          >
            {t("In {count, plural, one {# sentence} other {# sentences}}", {
              count: explanation.recap.length,
            })}
          </h3>
          <ol className="flex flex-col gap-3">
            {explanation.recap.map((sentence, index) => (
              <li className="flex gap-3" key={sentence}>
                <span className="text-muted-foreground w-4 shrink-0 text-sm tabular-nums">
                  {index + 1}
                </span>
                <span className="text-pretty">{sentence}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="explain-go-further" className="flex flex-col gap-3">
        <h3
          className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
          id="explain-go-further"
        >
          {t("Want to go further?")}
        </h3>

        {deeper}

        {questions.length > 0 && (
          <ul className="flex flex-col">
            {questions.map((question) => (
              <GoFurtherRow
                description={t("Quick explanation · 5 min")}
                href={questionHref(question)}
                icon={<LightbulbIcon className="text-amber-600 dark:text-amber-400" />}
                key={question}
                title={question}
              />
            ))}
          </ul>
        )}
      </section>

      <DoneLink href={doneHref} saving={saving} />
    </div>
  );
}
