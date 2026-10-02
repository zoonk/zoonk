"use client";

import { type ExplanationView } from "@zoonk/core/view-models/explain/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { AtomIcon, CheckIcon, ChevronRightIcon, LightbulbIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePrimaryVariant } from "../_utils/fun-primary";
import { ContentThumbsRow } from "../feedback/content-thumbs";
import { LearnLink } from "../learn-link";

/** What the check earned, once the explanation is saved. */
type ExplainResult = { answered: number; brainPower: number | null; correct: number };

const CARD_CLASS =
  "bg-card ring-foreground/10 in-data-[mode=fun]:fun-glass rounded-3xl p-4 ring-1 sm:p-5";

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
        className="hover:bg-muted/60 focus-visible:ring-ring/50 in-data-[mode=fun]:hover:bg-fun-soft -mx-2 flex min-h-14 items-center gap-3 rounded-2xl px-2 py-2 outline-none focus-visible:ring-[3px]"
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

/**
 * The end of a quick explanation: "Now you know", the recap in three sentences, what the one
 * question earned, quiet thumbs on the explanation, and "Want to go further?" into the subject's
 * Overview course or another quick question. One button finishes.
 */
export function ExplainEnding({
  courseHref,
  doneHref,
  explanation,
  questionHref,
  result,
}: {
  courseHref: string | null;
  doneHref: string;
  explanation: Pick<ExplanationView, "goFurther" | "lesson" | "recap" | "title">;
  /** Where a related question starts: onboarding with the question filled in. */
  questionHref: (question: string) => string;
  result: ExplainResult;
}) {
  const t = useExtracted();
  const primaryVariant = usePrimaryVariant();
  const doneRef = useEnterClick<HTMLAnchorElement>();
  const { course, questions } = explanation.goFurther;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      <span className="bg-success/10 text-success flex size-12 items-center justify-center rounded-full">
        <CheckIcon aria-hidden="true" className="size-6" />
      </span>

      <div className="flex flex-col gap-1" role="status">
        <p className="text-muted-foreground text-sm font-medium">{t("Now you know")}</p>
        <h2 className="in-data-[mode=fun]:font-fun-display text-3xl font-semibold tracking-tight text-balance">
          {explanation.title}
        </h2>
        <p className="text-muted-foreground">
          {[
            result.answered > 0 &&
              t("{correct, number} of {answered, number} right", {
                answered: result.answered,
                correct: result.correct,
              }),
            // Read again, it earns nothing new: "+0" would only read as a loss.
            Boolean(result.brainPower) &&
              t("+{points, number} Brain Power", { points: result.brainPower ?? 0 }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
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

      {explanation.lesson && (
        <ContentThumbsRow
          about="explanation"
          target={{ contentId: explanation.lesson.id, contentKind: "lesson" }}
        />
      )}

      {(course || questions.length > 0) && (
        <section aria-labelledby="explain-go-further" className="flex flex-col gap-2">
          <h3
            className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            id="explain-go-further"
          >
            {t("Want to go further?")}
          </h3>
          <ul className="flex flex-col">
            {course && courseHref && (
              <GoFurtherRow
                description={t("Overview · {count, plural, one {# chapter} other {# chapters}}", {
                  count: course.chapterCount,
                })}
                href={courseHref}
                icon={<AtomIcon className="text-violet-600 dark:text-violet-400" />}
                title={course.title}
              />
            )}
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
        </section>
      )}

      <LearnLink
        className={cn(
          buttonVariants({ size: "lg", variant: primaryVariant }),
          "h-12 w-full text-base",
        )}
        href={doneHref}
        ref={doneRef}
      >
        {t("Done")}
      </LearnLink>
    </div>
  );
}
