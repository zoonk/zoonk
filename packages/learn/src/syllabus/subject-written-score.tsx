"use client";

import { type WrittenPractice } from "@zoonk/core/plans/written-practice-contract";
import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import {
  ListGroup,
  ListRowBody,
  ListRowContent,
  ListRowDescription,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { StepRow, StepRows } from "../_components/step-card";
import { FactSegments } from "../_components/task-meta";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useWritingTaskTitle } from "../writing/writing-header";
import { useFormatPointsRange } from "../writing/writing-labels";
import { WrittenStanding } from "./subject-written-standing";
import { getTrendBarShares } from "./written-trend";

export type WrittenSubject = NonNullable<WrittenPractice["subjects"]>[number];

const PERCENT = 100;
const TREND_SAMPLES = 4;

export function findWrittenSubject({
  practice,
  subject,
}: {
  practice: WrittenPractice | null;
  subject: SyllabusSubject;
}): WrittenSubject | null {
  return (
    practice?.subjects?.find(({ points }) => subject.areas.some((area) => area === points.name)) ??
    null
  );
}

/** One small bar per answer, oldest first, the latest in full color. */
function TrendBars({ values }: { values: (number | null)[] }) {
  const shares = getTrendBarShares(values);

  if (shares.length === 0) {
    return null;
  }

  return (
    <span aria-hidden="true" className="flex h-5 shrink-0 items-end gap-0.5">
      {shares.map((share, index) => (
        <span
          className={cn(
            "rounded-meter w-1.5",
            index === values.length - 1 ? "bg-success" : "bg-success/40",
            values[index] === null && "bg-surface-3",
          )}
          // oxlint-disable-next-line react/no-array-index-key -- the bars are the answers in order
          key={index}
          style={{ height: `${share * PERCENT}%` }}
        />
      ))}
    </span>
  );
}

function TrendRow({
  label,
  last,
  values,
}: {
  label: string;
  last: string;
  values: (number | null)[];
}) {
  if (values.every((value) => value === null)) {
    return null;
  }

  return (
    <StepRow>
      <span className="min-w-0 flex-1">{label}</span>
      <TrendBars values={values} />
      <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums">{last}</span>
    </StepRow>
  );
}

function WrittenTrend({ written }: { written: WrittenSubject }) {
  const t = useExtracted();
  const format = useFormatter();
  const samples = written.trend.slice(-TREND_SAMPLES);
  const latest = samples.at(-1);

  if (!latest) {
    return null;
  }

  const share = (value: number | null) =>
    value === null ? "" : format.number(value, { maximumFractionDigits: 0, style: "percent" });

  return (
    <PageSection>
      <PageSectionHeader>
        <PageSectionTitle>{t("Your progress")}</PageSectionTitle>
        <PageSectionDetail className="font-mono">
          {t("{count, plural, one {last answer} other {last # answers}}", {
            count: samples.length,
          })}
        </PageSectionDetail>
      </PageSectionHeader>
      <StepRows>
        <TrendRow
          label={t("Content")}
          last={share(latest.contentShare)}
          values={samples.map(({ contentShare }) => contentShare)}
        />
        <TrendRow
          label={t("Presentation and structure")}
          last={share(latest.presentationShare)}
          values={samples.map(({ presentationShare }) => presentationShare)}
        />
        <TrendRow
          label={t("Language errors")}
          last={t("{count, plural, one {# error} other {# errors}}", { count: latest.errors })}
          values={samples.map(({ errors }) => errors)}
        />
      </StepRows>
    </PageSection>
  );
}

type WrittenAnswer = WrittenSubject["answers"][number];

/** The server's count of the lines sent, against the question's limit when it has one. */
function useLineFact() {
  const t = useExtracted();

  return function lineFact({ estimatedLines, lines }: WrittenAnswer): string | null {
    if (estimatedLines === undefined) {
      return lines === null
        ? null
        : t("{count, plural, one {# line} other {# lines}}", { count: lines });
    }

    return lines === null
      ? t("{count, plural, one {about # line} other {about # lines}}", { count: estimatedLines })
      : t("about {used} of {lines} lines", { lines: String(lines), used: String(estimatedLines) });
  };
}

/** A levels answer's result: how many criteria are complete. A points answer shows its range instead. */
function useCriteriaResult() {
  const t = useExtracted();

  return function criteriaResult({ criteria, range }: WrittenAnswer): string | null {
    return criteria && !range
      ? t({
          description:
            "A past written answer graded by level: how many of its criteria were fully met, out of all of them.",
          message: "{complete} of {total} criteria complete",
          values: { complete: String(criteria.complete), total: String(criteria.total) },
        })
      : null;
  };
}

function AnswerRow({ answer, href }: { answer: WrittenAnswer; href: string }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const lineFact = useLineFact();
  const writingTitle = useWritingTaskTitle();
  const formatRange = useFormatPointsRange();
  const criteriaResult = useCriteriaResult()(answer);

  return (
    <ListRowLink href={href}>
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle>{answer.title}</ListRowTitle>
          {/* Its own line: as a trailing value it would squeeze the title on a phone. */}
          {criteriaResult && <ListRowDescription>{criteriaResult}</ListRowDescription>}
          <ListRowDescription>
            <FactSegments
              facts={[
                answer.unit === "drill" && writingTitle({ title: null, unit: "drill" }),
                lineFact(answer),
                answer.versions > 1 &&
                  t("{count, plural, one {# version} other {# versions}}", {
                    count: answer.versions,
                  }),
                formatDate(answer.date),
              ]}
            />
          </ListRowDescription>
        </ListRowContent>
        {answer.range && (
          <ListRowTrailing className="font-mono text-xs">
            {formatRange(answer.range, { decimals: answer.decimals })}
          </ListRowTrailing>
        )}
      </ListRowBody>
    </ListRowLink>
  );
}

function WrittenAnswers({
  answerHref,
  written,
}: {
  answerHref: (attemptId: string) => string;
  written: WrittenSubject;
}) {
  const t = useExtracted();

  if (written.answers.length === 0) {
    return null;
  }

  return (
    <PageSection>
      <PageSectionHeader>
        <PageSectionTitle>{t("Your answers")}</PageSectionTitle>
        <PageSectionDetail className="font-mono">{written.answers.length}</PageSectionDetail>
      </PageSectionHeader>
      <ListGroup>
        {written.answers.map((answer) => (
          <AnswerRow answer={answer} href={answerHref(answer.attemptId)} key={answer.attemptId} />
        ))}
      </ListGroup>
    </PageSection>
  );
}

/**
 * A written part's page: where the learner stands (in the aside on a computer), how the answers
 * move, and each answer.
 */
export function SubjectWrittenScore({
  answerHref,
  written,
}: {
  answerHref: (attemptId: string) => string;
  written: WrittenSubject;
}) {
  return (
    <>
      <div className="min-[72rem]:hidden">
        <WrittenStanding titled written={written} />
      </div>
      <WrittenTrend written={written} />
      <WrittenAnswers answerHref={answerHref} written={written} />
    </>
  );
}
