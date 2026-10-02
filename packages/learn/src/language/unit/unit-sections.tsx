"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@zoonk/ui/components/accordion";
import { cn } from "@zoonk/ui/lib/utils";
import {
  BookOpenTextIcon,
  CircleCheckIcon,
  LanguagesIcon,
  type LucideIcon,
  TargetIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { SectionLabel } from "../../_components/section-label";
import { LanguageCard, LanguageCardTitle } from "../language-card";

/** A unit card's first line: an icon, the title and, on the right, a count or a note. */
export function UnitCardHeader({
  aside,
  icon: Icon,
  id,
  title,
}: {
  aside?: React.ReactNode;
  icon: LucideIcon;
  id: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      <LanguageCardTitle className="min-w-0 flex-1 text-sm" id={id}>
        {title}
      </LanguageCardTitle>
      {aside && (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{aside}</span>
      )}
    </div>
  );
}

/**
 * The unit's "I can" objectives. They're checked once every lesson is done, and otherwise say
 * what the learner will be able to do.
 */
export function UnitObjectives({ view }: { view: LanguageUnitView }) {
  const t = useExtracted();
  const { lessons, unit } = view;
  const finished = lessons.length > 0 && lessons.every((lesson) => lesson.done);

  if (unit.objectives.length === 0) {
    return null;
  }

  const Icon = finished ? CircleCheckIcon : TargetIcon;

  return (
    <section aria-labelledby="unit-objectives" className="flex flex-col gap-3">
      <SectionLabel id="unit-objectives">
        {finished ? t("I can already…") : t("By the end of this unit")}
      </SectionLabel>
      <ul className="flex flex-col gap-2.5">
        {unit.objectives.map((objective) => (
          <li className="flex items-start gap-3" key={objective}>
            <Icon
              aria-hidden="true"
              className={cn(
                "mt-0.5 size-5 shrink-0",
                finished
                  ? "text-success in-data-[mode=fun]:text-fun-accent-lime"
                  : "text-muted-foreground",
              )}
            />
            {objective}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Grammar tips pinned from the unit's lessons: the first one open, the rest a tap away. Tip text
 * is lesson text (emphasis, short lists), so the host renders it the way lessons do.
 */
export function UnitGrammarTips({
  renderText,
  tips,
}: {
  renderText: (text: string) => React.ReactNode;
  tips: LanguageUnitView["grammarTips"];
}) {
  const t = useExtracted();

  if (tips.length === 0) {
    return null;
  }

  return (
    <LanguageCard aria-labelledby="unit-grammar-tips">
      <UnitCardHeader
        aside={tips.length}
        icon={BookOpenTextIcon}
        id="unit-grammar-tips"
        title={t("Grammar tips")}
      />
      <Accordion className="gap-2" defaultValue={[0]} variant="ghost">
        {tips.map((tip, index) => (
          <AccordionItem
            className="bg-muted/60 in-data-[mode=fun]:bg-fun-soft rounded-2xl"
            key={tip.title}
            value={index}
            variant="ghost"
          >
            <AccordionTrigger className="px-4 py-3 text-base hover:no-underline">
              {tip.title}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {renderText(tip.text)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </LanguageCard>
  );
}

/** How many words the unit teaches, with the first few. */
export function UnitWords({ words }: { words: LanguageUnitView["words"] }) {
  const t = useExtracted();
  const more = words.count - words.sample.length;

  if (words.count === 0) {
    return null;
  }

  return (
    <LanguageCard aria-labelledby="unit-words">
      <UnitCardHeader
        aside={words.count}
        icon={LanguagesIcon}
        id="unit-words"
        title={t("Words in this unit")}
      />
      <p className="text-muted-foreground text-sm">
        {words.sample.join(" · ")}
        {more > 0 && ` ${t("and {count, number} more", { count: more })}`}
      </p>
    </LanguageCard>
  );
}
