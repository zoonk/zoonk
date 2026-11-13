"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { DetailsDrawer } from "../_components/details-drawer";
import { usePassMarksNote } from "../_utils/use-pass-marks-note";
import { useMockScreen } from "./mock-context";
import { useMockAbout } from "./mock-notes";
import { MockResultAnswers, hasAnswerCounts } from "./mock-result-answers";
import { MockResultInsights, useHasInsights } from "./mock-result-insights";
import { MockResultPoints, hasTestRows } from "./mock-result-points";
import { ResultSection } from "./mock-result-section";

function PassMarks() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { passMarks } = runner.view;
  const note = usePassMarksNote(passMarks);

  if (!passMarks) {
    return null;
  }

  return (
    <ResultSection title={t("To pass")}>
      <div className="text-muted-foreground flex flex-col gap-1 text-sm">
        {passMarks.texts.map((text) => (
          <p key={text} lang={passMarks.language}>
            {text}
          </p>
        ))}
        {note && <p>{note}</p>}
      </div>
    </ResultSection>
  );
}

/**
 * The result's first step answers "how did it go?" in one number and one sentence. Every count,
 * table and caveat behind that answer waits here, for the learner who asks.
 */
export function MockResultDetails({ result }: { result: MockResult }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const about = useMockAbout(runner.view);
  const hasInsights = useHasInsights();
  const hasAnswers = hasAnswerCounts(result);
  const hasPoints = hasTestRows(result.points);

  if (!hasAnswers && !hasPoints && !runner.view.passMarks && !hasInsights && !about) {
    return null;
  }

  return (
    <DetailsDrawer label={t("Details")} title={t("Details")} trigger="small">
      <div className="flex flex-col gap-8 pb-2">
        {hasAnswers && (
          <ResultSection title={t("Answers")}>
            <MockResultAnswers result={result} />
          </ResultSection>
        )}
        {hasPoints && result.points && <MockResultPoints points={result.points} />}
        <PassMarks />
        {hasInsights && <MockResultInsights />}
        {about && <ResultSection title={t("About this mock exam")}>{about}</ResultSection>}
      </div>
    </DetailsDrawer>
  );
}
