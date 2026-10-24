"use client";

import { LayersIcon, LibraryBigIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  ListGroup,
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import { useFormatIsoDate } from "../_utils/iso-date";
import { PlanBasesSheet } from "./plan-bases-sheet";
import { usePlanCoverage } from "./plan-coverage";
import { useFullCourse } from "./plan-full-course";
import { useStudyEverything } from "./study-everything";
import { usePlanBases, useSummaryText } from "./use-bases-texts";

/**
 * The choices a new plan comes with, on the plan's reveal, each a row opening its sheet: how its
 * prerequisites are studied (the sheet recommends how when the learner asks), and studying
 * everything at the learner's own pace, when the plan's notice doesn't already offer it (its time
 * covers the goal by its date). Nothing when there's nothing to choose.
 */
export function PlanChoices() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const bases = usePlanBases();
  const course = useFullCourse();
  const coverage = usePlanCoverage();
  const summaryText = useSummaryText();
  const studyEverything = useStudyEverything();
  const [basesOpen, setBasesOpen] = useState(false);

  const everything =
    course && !course.on && !coverage && course.endDate
      ? { ...course, endDate: course.endDate }
      : null;

  if (!bases && !everything) {
    return null;
  }

  return (
    <ListGroup aria-label={t("Your choices")} role="group">
      {bases && (
        <ListRowButton onClick={() => setBasesOpen(true)}>
          <ListRowLeading>
            <ListRowIcon>
              <LayersIcon />
            </ListRowIcon>
          </ListRowLeading>
          <ListRowContent>
            <ListRowTitle>{summaryText(bases)}</ListRowTitle>
            <ListRowDescription>{t("Change how you study them.")}</ListRowDescription>
          </ListRowContent>
        </ListRowButton>
      )}

      {everything && (
        <ListRowButton onClick={() => studyEverything(everything)}>
          <ListRowLeading>
            <ListRowIcon>
              <LibraryBigIcon />
            </ListRowIcon>
          </ListRowLeading>
          <ListRowContent>
            <ListRowTitle>{t("Study everything, no deadline")}</ListRowTitle>
            <ListRowDescription>
              {t("At your own pace, you finish around {month}.", {
                month: formatDate(everything.endDate, "month"),
              })}
            </ListRowDescription>
          </ListRowContent>
        </ListRowButton>
      )}

      {bases && <PlanBasesSheet bases={bases} onOpenChange={setBasesOpen} open={basesOpen} />}
    </ListGroup>
  );
}
