"use client";

import { FOCUS_TEST_SOURCE } from "@zoonk/core/learner/placement/focus-test-contract";
import { NOTICE_SOURCE, PHASE_DATES_SOURCE } from "@zoonk/core/plans/change-contract";
import { OWN_LEVEL_SOURCE } from "@zoonk/core/plans/own-level-contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useSentenceSpace } from "../_utils/locale";
import { type GoalDateKind, getGoalDateKind } from "./goal-date-kind";
import { usePlanScreen } from "./plan-context";
import { useOperationQuestion } from "./use-operation-question";
import { useFollowsGuideSentence, useOperationStatement } from "./use-operation-statement";
import { usePhaseDatesQuestion } from "./use-phase-dates-sentence";
import { useShortList } from "./use-short-list";
import { type PlanChangeContent, useSystemChangeSentence } from "./use-system-change-sentence";

function useGuideQuestion() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const followsGuide = useFollowsGuideSentence();

  return ({
    examDocument: document,
    operations,
  }: Pick<PlanChangeView, "examDocument" | "operations">): string => {
    const follows = operations.some((operation) => operation.kind === "followNotice");
    const day = operations.find((operation) => operation.kind === "setNoticeDate");
    const date = day?.kind === "setNoticeDate" ? formatDate(day.targetDate, "long") : null;
    const estimated = day?.kind === "setNoticeDate" && day.estimated;

    if (follows && date) {
      return estimated
        ? t({
            description:
              'In the "notice" form the document is the exam\'s public notice (Brazil\'s "edital"); otherwise it is an official guide. {date} is a day, like "May 5".',
            message:
              "{document, select, notice {Follow the exam's official guide, with the exam around {date}?} other {Follow the exam's official guide, with the exam around {date}?}}",
            values: { date, document },
          })
        : t({
            description:
              'In the "notice" form the document is the exam\'s public notice (Brazil\'s "edital"); otherwise it is an official guide. {date} is a day, like "May 5".',
            message:
              "{document, select, notice {Follow the exam's official guide, with the exam on {date}?} other {Follow the exam's official guide, with the exam on {date}?}}",
            values: { date, document },
          });
    }

    if (follows) {
      return t({
        description:
          'In the "notice" form the document is the exam\'s public notice (Brazil\'s "edital"); otherwise it is an official guide.',
        message:
          "{document, select, notice {Follow the exam's official guide?} other {Follow the exam's official guide?}}",
        values: { document },
      });
    }

    if (date) {
      return estimated
        ? t("Move your exam date to around {date}?", { date })
        : t(
            "{dateKind, select, exam {Move your exam date to {date}?} goal {Move your end date to {date}?} other {Move your date to {date}?}}",
            { date, dateKind: "exam" },
          );
    }

    return followsGuide(document);
  };
}

export function useAppliedLine() {
  const t = useExtracted();

  return (todaySession: PlanChangeView["todaySession"]): string => {
    if (todaySession === "changed") {
      return t("Done. Today's lessons changed too.");
    }

    return todaySession === "unchanged" ? t("Done. It starts on your next study day.") : t("Done.");
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
  const guideQuestion = useGuideQuestion();
  const systemSentence = useSystemChangeSentence();
  const phaseDatesQuestion = usePhaseDatesQuestion();
  const space = useSentenceSpace();

  const statements = (change: PlanChangeContent): string =>
    change.operations
      .map((operation) => statement({ dateKind, document: change.examDocument, operation }))
      .join(space);

  const asked = (change: PlanChangeContent): ChangeWords => {
    const [first, ...others] = change.operations;

    if (change.source === NOTICE_SOURCE) {
      return { title: guideQuestion(change), why: change.reason };
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

/** On the Plan, where the goal's kind is known. */
export function usePlanChangeWords() {
  const { goal } = usePlanScreen();
  return useChangeWords({ dateKind: getGoalDateKind(goal.kind) });
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
          date: formatDate(change.officialDate.date, "long"),
        })
      : null;
  };
}
