"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { PracticeConversation } from "./practice-conversation";
import { UnitHeader } from "./unit-header";
import { UnitMistakes } from "./unit-mistakes";
import { UnitGrammarTips, UnitObjectives, UnitWords } from "./unit-sections";

/** The host starts a practice call for the unit and opens it; false when it didn't start. */
type LanguageUnitActions = { startConversation: (minutes: number) => Promise<boolean> };

/**
 * A language unit's page, one real situation, in Focus and Fun alike: what the learner will be
 * able to do, the grammar tips pinned from its lessons, its words, their open mistakes by skill
 * and a conversation to practice.
 *
 * ```tsx
 * <LanguageUnitScreen
 *   actions={actions}
 *   backHref="/content"
 *   renderLessonText={(text) => <LessonText text={text} />}
 *   unit={unit}
 * />
 * ```
 */
export function LanguageUnitScreen({
  actions,
  backHref,
  renderLessonText,
  unit,
}: {
  actions: LanguageUnitActions;
  backHref: string;
  /** Grammar tips are lesson text (emphasis, short lists): the host draws it as lessons do. */
  renderLessonText: (text: string) => React.ReactNode;
  unit: LanguageUnitView;
}) {
  return (
    <div className="flex flex-col gap-6" data-slot="language-unit">
      <UnitHeader backHref={backHref} view={unit} />
      <UnitObjectives view={unit} />

      <div className="flex flex-col gap-3">
        <UnitGrammarTips renderText={renderLessonText} tips={unit.grammarTips} />
        <UnitWords words={unit.words} />
        <UnitMistakes mistakes={unit.mistakes} />
        <PracticeConversation
          conversation={unit.conversation}
          onStart={actions.startConversation}
        />
      </div>
    </div>
  );
}
