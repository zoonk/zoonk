"use client";

import { type LanguageProgressView } from "@zoonk/core/view-models/language/contract";
import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { useExtracted } from "next-intl";
import { FadingSkills } from "../../progress/fading-skills";
import { MistakesLink } from "../../progress/mistakes-link";
import {
  type ProgressActions,
  type ProgressHrefs,
  ProgressScreenProvider,
} from "../../progress/progress-context";
import { StatsLinks } from "../../progress/stats-links";
import { WeeklySummary } from "../../progress/weekly-summary";
import { CurrentUnitSection } from "../current-unit";
import { CanDoList } from "./can-do-list";
import { RecentTiles } from "./recent-tiles";
import { SkillLevelsCard } from "./skill-levels-card";
import { SpeakingMockCard } from "./speaking-mock-card";

/** Progress's own links, plus the current unit's page (null when the goal has no unit yet). */
type LanguageProgressHrefs = ProgressHrefs & { unit: string | null };

/** The host starts the speaking mock and opens the call; false when it didn't start. */
type LanguageProgressActions = { startSpeakingMock: () => Promise<boolean> };

/**
 * A language goal measures progress by level per skill, so the areas and their "Practice now"
 * aren't shown here and nothing asks for area practice.
 */
const NO_AREA_PRACTICE: ProgressActions = { practiceArea: async () => "nothingToPractice" };

/**
 * Progress for a language goal, in both modes: level by skill against the target, "I can
 * already…", the current situation, the words known, the last four weeks and, for IELTS or TOEFL,
 * the speaking mock. The generic sections that fit every goal follow: the mistakes notebook, fading
 * skills, the week and the stats pages. Preparation, areas and chapter mastery are left out: the
 * levels and the "I can" list say the same thing in a language's own terms.
 */
export function LanguageProgressScreen({
  actions,
  hrefs,
  language,
  progress,
}: {
  actions: LanguageProgressActions;
  hrefs: LanguageProgressHrefs;
  language: LanguageProgressView;
  progress: ProgressView;
}) {
  const t = useExtracted();
  const { currentUnit } = language;

  return (
    <div className="flex flex-col gap-8" data-slot="language-progress">
      <h1 className="sr-only">{t("Progress in {goal}", { goal: language.goal.title })}</h1>
      <SkillLevelsCard progress={language} />
      <CanDoList canDo={language.canDo} />

      {currentUnit && hrefs.unit && <CurrentUnitSection href={hrefs.unit} unit={currentUnit} />}

      <RecentTiles recent={language.recent} wordsKnown={language.wordsKnown} />

      {language.speakingMock && (
        <SpeakingMockCard exam={language.speakingMock} onStart={actions.startSpeakingMock} />
      )}

      <ProgressScreenProvider value={{ actions: NO_AREA_PRACTICE, hrefs, progress }}>
        <MistakesLink />
        <FadingSkills />
        <WeeklySummary />
        <StatsLinks />
      </ProgressScreenProvider>
    </div>
  );
}
