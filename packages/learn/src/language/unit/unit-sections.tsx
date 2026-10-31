"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { useExtracted } from "next-intl";
import {
  LIST_GROUP_CLASS,
  LIST_ROW_CLASS,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
} from "../../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../../_components/page";
import { CanDoMark } from "../progress/can-do-list";

const SHOWN_OBJECTIVES = 3;

export function UnitObjectives({ view }: { view: LanguageUnitView }) {
  const t = useExtracted();
  const { lessons, unit } = view;
  const finished = lessons.length > 0 && lessons.every((lesson) => lesson.done);

  if (unit.objectives.length === 0) {
    return null;
  }

  return (
    <PageSection aria-labelledby="unit-objectives">
      <PageSectionHeader>
        <PageSectionTitle id="unit-objectives">
          {finished ? t("I can already…") : t("By the end of this unit")}
        </PageSectionTitle>
      </PageSectionHeader>
      <ul className={LIST_GROUP_CLASS}>
        {unit.objectives.slice(0, SHOWN_OBJECTIVES).map((objective) => (
          <li className={LIST_ROW_CLASS} key={objective}>
            <ListRowLeading>
              <CanDoMark done={finished} />
            </ListRowLeading>
            <ListRowContent>
              <ListRowTitle className="font-normal">{objective}</ListRowTitle>
            </ListRowContent>
          </li>
        ))}
      </ul>
    </PageSection>
  );
}

export function UnitGrammarTips({
  renderText,
  tips,
}: {
  renderText: (text: string) => React.ReactNode;
  tips: LanguageUnitView["grammarTips"];
}) {
  return (
    <ul className="flex flex-col gap-4">
      {tips.map((tip) => (
        <li className="flex flex-col gap-1" key={tip.title}>
          <h3 className="text-sm font-semibold">{tip.title}</h3>
          <div className="text-muted-foreground text-sm">{renderText(tip.text)}</div>
        </li>
      ))}
    </ul>
  );
}

export function UnitWords({ words }: { words: LanguageUnitView["words"] }) {
  const t = useExtracted();
  const more = words.count - words.sample.length;

  return (
    <p className="text-muted-foreground text-sm">
      {words.sample.join(" · ")}
      {more > 0 && ` ${t("and {count, number} more", { count: more })}`}
    </p>
  );
}
