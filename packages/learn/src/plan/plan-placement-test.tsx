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
import { useTestTime } from "../focus-test/use-focus-test-texts";
import { formatLevelRange } from "../language/level-test/level-test-parts";
import { usePlanScreen } from "./plan-context";

type PlacementTestRow = NonNullable<PlanView["placementTest"]>;
type LanguageRow = Extract<PlacementTestRow, { kind: "language" }>;

function useLanguageResultFacts() {
  const t = useExtracted();

  return (result: NonNullable<LanguageRow["result"]>): string[] => {
    const { listening: listeningRange, reading: readingRange } = result.ranges;
    const reading = readingRange && formatLevelRange(readingRange);
    const listening = listeningRange && formatLevelRange(listeningRange);

    return [
      reading &&
        t({
          description: "A CEFR level range the test found for reading, such as “B1–B2”.",
          message: "Reading {range}",
          values: { range: reading },
        }),
      listening &&
        t({
          description: "A CEFR level range the test found for listening, such as “B1–B2”.",
          message: "Listening {range}",
          values: { range: listening },
        }),
    ].filter((fact) => typeof fact === "string");
  };
}

function useRowFacts() {
  const t = useExtracted();
  const time = useTestTime();
  const formatDate = useFormatMomentDate();
  const languageFacts = useLanguageResultFacts();

  return (test: PlacementTestRow): string[] => {
    if (test.state === "continue") {
      return [t("In progress"), time.left(test.estimatedMinutes)];
    }

    if (test.state === "start" || !test.result) {
      return [
        test.kind === "language"
          ? t("Find your level and skip what you know")
          : t("Skip lessons you already know"),
      ];
    }

    const date = formatDate(test.result.finishedAt);

    if (test.kind === "language") {
      return [...languageFacts(test.result), date];
    }

    return [
      t({
        description: "A fact on the Plan's test row: how many lessons the last test skipped.",
        message:
          "{count, plural, =0 {No lessons skipped} one {# lesson skipped} other {# lessons skipped}}",
        values: { count: test.result.lessonsSkipped },
      }),
      date,
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
