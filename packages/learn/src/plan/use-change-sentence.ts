"use client";

import { FOCUS_TEST_SOURCE } from "@zoonk/core/learner/placement/focus-test-contract";
import { PHASE_DATES_SOURCE } from "@zoonk/core/plans/change-contract";
import { OWN_LEVEL_SOURCE } from "@zoonk/core/plans/own-level-contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useSentenceSpace } from "../_utils/locale";
import { type GoalDateKind, getGoalDateKind } from "./goal-date-kind";
import { usePlanScreen } from "./plan-context";
import { useOperationQuestion } from "./use-operation-question";
import { useOperationStatement } from "./use-operation-statement";
import { usePhaseDatesQuestion } from "./use-phase-dates-sentence";
import { useShortList } from "./use-short-list";
import { type PlanChangeContent, useSystemChangeSentence } from "./use-system-change-sentence";

/** A notice that gives only a likely date asks about that date; every other date reads as any date. */
function useEstimatedDateQuestion() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function estimatedDateQuestion({
    operations,
  }: Pick<PlanChangeView, "operations">): string | null {
    const day = operations.find((operation) => operation.kind === "setNoticeDate");

    return day?.kind === "setNoticeDate" && day.estimated
      ? t("Move your exam date to around {date}?", { date: formatDate(day.targetDate, "sentence") })
      : null;
  };
}

export function useAppliedLine() {
  const t = useExtracted();

  return (todaySession: PlanChangeView["todaySession"]): string => {
    if (todaySession === "changed") {
      return t("Done. Today's lessons changed too.");
    }

    return todaySession === "unchanged"
      ? t("Done. The change starts on your next study day.")
      : t("Done.");
  };
}

type ChangeWords = {
  /** The question a proposal asks, or what an applied change did. */
  title: string;
  /** At most one supporting sentence: the proposal's own reason, or what a mixed change holds. */
  why: string | null;
};

/**
 * A change nobody applied yet asks a question in the learner's words; once applied it says what
 * it did. What it moves is never said here: that's its effect (`PlanEffectDiff`).
 */
export function useChangeWords({ dateKind = "unknown" }: { dateKind?: GoalDateKind } = {}) {
  const t = useExtracted();
  const format = useFormatter();
  const shortList = useShortList();
  const question = useOperationQuestion();
  const statement = useOperationStatement();
  const estimatedDateQuestion = useEstimatedDateQuestion();
  const systemSentence = useSystemChangeSentence();
  const phaseDatesQuestion = usePhaseDatesQuestion();
  const space = useSentenceSpace();

  const statements = (change: PlanChangeContent): string =>
    change.operations
      .map((operation) => statement({ dateKind, document: change.examDocument, operation }))
      .join(space);

  const asked = (change: PlanChangeContent): ChangeWords => {
    const [first, ...others] = change.operations;

    const estimated = estimatedDateQuestion(change);

    if (estimated) {
      return { title: estimated, why: change.reason };
    }

    if (change.source === PHASE_DATES_SOURCE) {
      const phaseDates = phaseDatesQuestion(change.effect);
      return { title: phaseDates.title, why: change.reason ?? phaseDates.why };
    }

    const own = first && others.length === 0 ? question(first, dateKind) : null;

    if (own) {
      return { title: own, why: change.reason };
    }

    return {
      title: t("Change your plan?"),
      why: change.reason ?? (change.operations.length > 0 ? statements(change) : null),
    };
  };

  return (change: PlanChangeContent): ChangeWords => {
    const [first] = change.operations;
    const system = systemSentence(change);

    if (system) {
      return { title: system, why: null };
    }

    if (change.source === OWN_LEVEL_SOURCE && first?.kind === "addSkills") {
      return {
        title: t("For your new level, these come first: {skills}.", {
          skills: shortList(
            first.skills.map((skill) => skill.name),
            "topics",
          ),
        }),
        why: null,
      };
    }

    if (
      change.source === FOCUS_TEST_SOURCE &&
      first?.kind === "focusAreas" &&
      first.areas.length > 0
    ) {
      return {
        title: t("Your Focus test suggests more time for {subjects}.", {
          subjects: format.list(first.areas, { type: "conjunction" }),
        }),
        why: null,
      };
    }

    if (["proposed", "declined", "replaced"].includes(change.status)) {
      return asked(change);
    }

    return {
      title: change.operations.length > 0 ? statements(change) : t("Your plan changed."),
      why: null,
    };
  };
}

export function usePlanDateKind(): GoalDateKind {
  const { goal } = usePlanScreen();
  return getGoalDateKind(goal.kind);
}

/** On the Plan, where the goal's kind is known. */
function usePlanChangeWords() {
  return useChangeWords({ dateKind: usePlanDateKind() });
}

export function usePlanChangeSentence() {
  const words = usePlanChangeWords();
  return (change: PlanChangeContent): string => words(change).title;
}

export function useOfficialDateLine() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function officialDateLine(
    change: Pick<PlanChangeView, "officialDate" | "status">,
  ): string | null {
    return change.status === "proposed" && change.officialDate
      ? t("The official exam date is {date}.", {
          date: formatDate(change.officialDate.date, "sentence"),
        })
      : null;
  };
}
