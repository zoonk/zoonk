"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import {
  ListRowContent,
  ListRowDescription,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { FactSegments } from "../_components/task-meta";
import { useFormatMomentDate } from "../_utils/iso-date";
import { useTestFacts } from "../placement-test/use-test-facts";
import { usePlanScreen } from "./plan-context";
import { useSkippedLessonsSentences } from "./use-skipped-lessons-sentences";

type PlacementTestRow = NonNullable<PlanView["placementTest"]>;
type CourseRow = Extract<PlacementTestRow, { kind: "learn" }>;

function useRowFacts() {
  const t = useExtracted();
  const facts = useTestFacts();
  const formatDate = useFormatMomentDate();
  const { skipped } = useSkippedLessonsSentences();

  const result = (test: PlacementTestRow, invitation: string, minutes: number | undefined) =>
    test.result
      ? [skipped(test.result.lessonsSkipped), formatDate(test.result.finishedAt)]
      : [invitation, minutes ? facts.about(minutes) : null];

  /** A test that's open says where it stands; otherwise its last result, or the invitation. */
  const course = (test: CourseRow) =>
    test.attempt
      ? [
          t("In progress"),
          facts.question({ number: test.attempt.answered + 1, total: test.attempt.questions }),
        ]
      : result(test, t("Skip lessons you already know"), test.offer?.estimatedMinutes);

  return (test: PlacementTestRow) => {
    if (test.kind === "learn") {
      return course(test);
    }

    if (test.state !== "continue") {
      return result(test, t("Find your level and skip what you know"), test.estimatedMinutes);
    }

    return [
      t("In progress"),
      test.answered !== undefined &&
        test.total !== undefined &&
        facts.question({ number: test.answered + 1, total: test.total }),
    ];
  };
}

/** The Plan's way into the test of what the learner already knows, and its last result. */
export function PlanPlacementTest({
  levelTestHref,
  placementTestHref,
}: {
  levelTestHref: string;
  placementTestHref: string;
}) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const rowFacts = useRowFacts();
  const test = plan.placementTest;

  if (!test || (test.state === "start" && test.estimatedMinutes === 0)) {
    return null;
  }

  return (
    <ListRowLink href={test.kind === "language" ? levelTestHref : placementTestHref}>
      <ListRowContent>
        <ListRowTitle>
          {test.kind === "language" ? t("Level test") : t("Test what you know")}
        </ListRowTitle>
        <ListRowDescription>
          <FactSegments facts={rowFacts(test)} />
        </ListRowDescription>
      </ListRowContent>
    </ListRowLink>
  );
}
