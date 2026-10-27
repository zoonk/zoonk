"use client";

import { type EssayView } from "@zoonk/core/exams/essays/contract";
import { useExtracted } from "next-intl";
import { PageSectionTitle } from "../_components/page";
import { TaskAsideContent } from "../_components/task-layout";
import { ItemStem, ItemText, QUESTION_TEXT_CLASS } from "../questions/item-text";
import { useEssayScreen } from "./essay-context";
import { CriteriaInView } from "./essay-rewrite-guide";

/** The writing's name and what it's graded by, as the screen's title. */
export function usePromptLabel(rubric: EssayView["rubric"]): string {
  const t = useExtracted();

  const labels: Record<EssayView["rubric"], string> = {
    ap: t("Free response · AP scoring guidelines"),
    custom: t("Writing practice"),
    enem: t("Essay · ENEM rubric"),
    oab: t("Writing practice"),
  };

  return labels[rubric];
}

/** What the texts to read before writing are, in the exam's own words where it has some. */
export function useTextsLabel(rubric: EssayView["rubric"]): string {
  const t = useExtracted();

  const labels: Record<EssayView["rubric"], string> = {
    ap: t("Supporting texts"),
    custom: t("Supporting texts"),
    enem: t("Motivating texts"),
    oab: t("The case"),
  };

  return labels[rubric];
}

/**
 * The texts to read before writing (ENEM's motivating texts, a case, sources) as a quote, under
 * their label on a phone, where they come before the instruction as in the exam's booklet; from
 * `lg` beside the box, the aside's label naming them, with the last grade's criteria under them
 * while rewriting. A short context (a theme, a situation) is part of the instruction instead.
 */
export function EssayTexts({ criteria, texts }: { criteria: boolean; texts: string | null }) {
  const { essay } = useEssayScreen();
  const label = useTextsLabel(essay.rubric);

  if (!texts && !criteria) {
    return null;
  }

  return (
    <TaskAsideContent className="flex flex-col gap-6" data-slot="essay-texts">
      {texts && (
        <section className="flex flex-col gap-3">
          <PageSectionTitle className="lg:group-data-aside/task:sr-only">{label}</PageSectionTitle>
          <ItemText
            className="border-border border-l-2 pl-4 text-sm leading-relaxed lg:group-data-aside/task:border-l-0 lg:group-data-aside/task:pl-0"
            text={texts}
          />
        </section>
      )}
      <CriteriaInView />
    </TaskAsideContent>
  );
}

/**
 * What to write, over the box at every size: a short context (a theme, the situation a
 * discursive question is about) as a quote, then the instruction in the question face.
 */
export function EssayInstruction({ context }: { context: string | null }) {
  const { essay } = useEssayScreen();

  return (
    <section className="flex flex-col gap-4" data-slot="essay-instruction">
      {context && (
        <ItemText
          className="border-border border-l-2 pl-4 text-sm leading-relaxed"
          text={context}
        />
      )}
      <div className={QUESTION_TEXT_CLASS}>
        <ItemStem text={essay.question} heading="h2" />
      </div>
    </section>
  );
}
