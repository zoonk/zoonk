"use client";

import { type ExplanationView } from "@zoonk/core/view-models/explain/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon, CircleHelpIcon, TargetIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { SectionLabel } from "../_components/section-label";
import { StatTile, StatTiles } from "../_components/stat-tile";
import { SuccessEyebrow } from "../_components/success-eyebrow";
import { LearnLink } from "../learn-link";
import { useQuickExplanationLabel } from "./quick-explanation-label";

/** What the check earned, once the explanation is saved. */
type ExplainResult = { answered: number; brainPower: number | null; correct: number };

const DONE_CLASS = cn(buttonVariants({ size: "lg" }), "w-full font-[560]");

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
    <LearnLink aria-keyshortcuts="Enter" className={DONE_CLASS} href={href} ref={doneRef}>
      {t("Done")}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}

/** What the one question earned, as numbers on their tiles; read again, it earns nothing new. */
function ResultTiles({ result }: { result: ExplainResult }) {
  const t = useExtracted();
  // "+0" would only read as a loss.
  const brainPower = result.brainPower ?? 0;

  if (result.answered === 0 && brainPower === 0) {
    return null;
  }

  return (
    <StatTiles className={cn("mt-3", (result.answered === 0 || brainPower === 0) && "grid-cols-1")}>
      {result.answered > 0 && (
        <StatTile
          icon={<TargetIcon />}
          label={t("Right answers")}
          tone="success"
          value={`${result.correct}/${result.answered}`}
        />
      )}
      {brainPower > 0 && (
        <StatTile
          icon={<BrainIcon />}
          label={t("Brain Power")}
          tone="brain"
          value={`+${brainPower}`}
        />
      )}
    </StatTiles>
  );
}

/**
 * A related question, as its own quick explanation. A quick explanation has no kind's color of its
 * own, so its mark is a quiet icon, lined up with the in-depth row's above it.
 */
function QuestionRow({ href, question }: { href: string; question: string }) {
  const quickExplanation = useQuickExplanationLabel();

  return (
    <ListRowLink href={href}>
      <ListRowLeading>
        <ListRowIcon>
          <CircleHelpIcon />
        </ListRowIcon>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{question}</ListRowTitle>
        <ListRowDescription>{quickExplanation}</ListRowDescription>
      </ListRowContent>
    </ListRowLink>
  );
}

/**
 * The end of a quick explanation: "✓ Now you know" over its title, what the one question earned,
 * the recap in three numbered sentences, and "Want to go further?": learning the subject in depth
 * as a plan of its own (the host's `deeper` control) or another quick question. "Done" finishes,
 * in the action bar at the bottom; a problem with it is reported from the lesson's "…" menu.
 */
export function ExplainEnding({
  deeper,
  doneHref,
  explanation,
  questionHref,
  result,
  saving = false,
}: {
  /** "I want to learn this in depth": the host's `ExplainDeeperLink`. */
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
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-7 px-4 pt-8">
      <div className="flex flex-col gap-2" role="status">
        <SuccessEyebrow>{t("Now you know")}</SuccessEyebrow>
        <h2 className="text-title">{explanation.title}</h2>
        <ResultTiles result={result} />
      </div>

      {explanation.recap.length > 0 && (
        <section aria-labelledby="explain-recap" className="flex flex-col gap-1">
          <SectionLabel id="explain-recap">
            {t("In {count, plural, one {# sentence} other {# sentences}}", {
              count: explanation.recap.length,
            })}
          </SectionLabel>
          <ol className="flex flex-col [&>li+li]:border-t">
            {explanation.recap.map((sentence, index) => (
              <li className="flex gap-3 py-3" key={sentence}>
                <span
                  aria-hidden="true"
                  className="text-faint w-4 shrink-0 font-mono text-xs leading-relaxed tabular-nums"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm leading-relaxed text-pretty">
                  {sentence}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="explain-go-further" className="flex flex-col gap-1">
        <SectionLabel id="explain-go-further">{t("Want to go further?")}</SectionLabel>

        {deeper}

        {questions.length > 0 && (
          <ListGroup>
            {questions.map((question) => (
              <QuestionRow href={questionHref(question)} key={question} question={question} />
            ))}
          </ListGroup>
        )}
      </section>

      <div className="bg-background border-border sticky bottom-0 -mx-4 mt-auto border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <DoneLink href={doneHref} saving={saving} />
      </div>
    </div>
  );
}
